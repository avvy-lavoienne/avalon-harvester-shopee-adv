"""Pipeline v4: schema-per-keyword (rule-first, NO per-product LLM call).

Workflow:
1. Untuk row: ambil search_query
2. Cek cache `keyword_schemas[search_query]`:
   - HIT  → apply schema (regex + rapidfuzz) → DONE (no LLM)
   - MISS → generate schema via DeepSeek 1×, cache, lalu apply

Hasil: 1 LLM call per UNIQUE keyword, bukan per produk.
Harga: price_range (P10 lower-bound) filter produk terlalu murah, tanpa upper bound.
"""
from __future__ import annotations
import asyncio
import logging
from typing import Any

from .schema_engine import apply_schema
from .schema_cache import get_schema, save_schema, fetch_samples, increment_counter, upsert_brands_taxonomy, load_all_taxonomy
from .schema_generator import generate_schema
from .categories import get_parser
from .category_detector import detect_category
from .known_brands import LAPTOP_BRANDS

logger = logging.getLogger(__name__)

_SCHEMA_MEMO: dict[str, dict[str, Any]] = {}
_PRICE_RANGE_MEMO: dict[str, dict[str, int] | None] = {}
_GENERATING: dict[str, asyncio.Lock] = {}
_GLOBAL_LOCK = asyncio.Lock()

_TAXONOMY: dict[str, set[str]] = {}
_TAXONOMY_LOCK = asyncio.Lock()
_TAXONOMY_INIT_DONE = False


async def _ensure_taxonomy_loaded():
    global _TAXONOMY, _TAXONOMY_INIT_DONE
    if _TAXONOMY_INIT_DONE:
        return
    async with _TAXONOMY_LOCK:
        if _TAXONOMY_INIT_DONE:
            return
        try:
            _TAXONOMY = await load_all_taxonomy()
            logger.info("Brand taxonomy loaded: %d categories", len(_TAXONOMY))
        except Exception as e:
            logger.warning("Failed to load brand taxonomy from DB: %s", e)
            _TAXONOMY = {}
        if "laptop" not in _TAXONOMY or not _TAXONOMY["laptop"]:
            _TAXONOMY["laptop"] = {b.upper() for b in LAPTOP_BRANDS}
            logger.info(
                "Seeded laptop taxonomy from known_brands.py (%d brands)",
                len(_TAXONOMY["laptop"]),
            )
            try:
                await upsert_brands_taxonomy("laptop", list(LAPTOP_BRANDS), "__seed__")
                logger.info("Laptop taxonomy seed persisted to DB")
            except Exception as e:
                logger.warning("Laptop taxonomy seed DB persist failed: %s", e)
        _TAXONOMY_INIT_DONE = True


async def _extract_and_upsert_brands(category: str, schema: dict, keyword: str):
    global _TAXONOMY
    brands_map = schema.get("brands", {}) or {}
    brand_names = list(brands_map.keys())
    if not brand_names:
        return
    brand_upper = {b.upper() for b in brand_names}
    if category not in _TAXONOMY:
        _TAXONOMY[category] = set()
    before = len(_TAXONOMY[category])
    _TAXONOMY[category].update(brand_upper)
    if len(_TAXONOMY[category]) > before:
        try:
            await upsert_brands_taxonomy(category, brand_names, keyword)
        except Exception as e:
            logger.debug("Brand taxonomy upsert failed: %s", e)


def _calc_price_range(samples: list[dict]) -> dict[str, int] | None:
    """Hitung minimum price (P10) dari sample.
    Hanya lower bound — tidak ada upper bound agar produk mahal tidak kena filter.
    """
    prices = [s["price"] for s in samples if isinstance(s.get("price"), (int, float)) and s["price"] > 0]
    if len(prices) < 5:
        return None
    prices.sort()
    p10 = prices[max(0, int(len(prices) * 0.10))]
    return {"min": p10}


async def _get_or_generate_schema(keyword: str) -> tuple[dict[str, Any] | None, bool]:
    if keyword in _SCHEMA_MEMO:
        return _SCHEMA_MEMO[keyword], False

    async with _GLOBAL_LOCK:
        if keyword not in _GENERATING:
            _GENERATING[keyword] = asyncio.Lock()
        keyword_lock = _GENERATING[keyword]

    async with keyword_lock:
        if keyword in _SCHEMA_MEMO:
            return _SCHEMA_MEMO[keyword], False

        # 1. Check Supabase cache
        cached = await get_schema(keyword)
        if cached and cached.get("schema"):
            logger.info("Schema cache HIT: %s (cat=%s)", keyword, cached.get("category"))
            schema = cached["schema"]
            _SCHEMA_MEMO[keyword] = schema
            # Hitung price_range dari sample terkini
            samples = await fetch_samples(keyword, limit=30)
            _PRICE_RANGE_MEMO[keyword] = _calc_price_range(samples)
            return schema, False

        # 2. Cache miss → generate via DeepSeek
        logger.info("Schema cache MISS, generating for: %s", keyword)
        samples = await fetch_samples(keyword, limit=12)
        if not samples:
            logger.warning("No sample products for keyword=%s, skip generate", keyword)
            return None, False

        try:
            result = await generate_schema(keyword, samples)
            schema = result["schema"]
            category = result.get("category", "generic")
            usage = result.get("usage") or {}
            tokens = usage.get("total_tokens", 0)
            model = result.get("model", "deepseek-chat")

            sample_names = [s["name"] for s in samples]
            await save_schema(
                keyword=keyword,
                category=category,
                schema=schema,
                sample_names=sample_names,
                tokens_used=tokens,
                model=model,
            )
            logger.info(
                "Schema generated & cached: keyword=%s, category=%s, tokens=%d",
                keyword, category, tokens,
            )
            _SCHEMA_MEMO[keyword] = schema
            _PRICE_RANGE_MEMO[keyword] = _calc_price_range(samples)
            return schema, True
        except Exception as e:
            logger.exception("Schema generation failed for %s: %s", keyword, e)
            return None, False


async def process_product(row: dict[str, Any]) -> dict[str, Any]:
    name = row.get("product_name") or row.get("name_raw") or ""
    search_query = (row.get("search_query") or "").strip()

    specs: dict[str, Any] = {}
    category = "generic"
    cleaning_method = "rule"
    llm_used = False
    detected_brand: str | None = None

    await _ensure_taxonomy_loaded()

    if search_query:
        schema, schema_was_generated = await _get_or_generate_schema(search_query)
        if schema:
            category = schema.get("category", "generic")
            detected_brand, specs = apply_schema(name, schema)
            if schema_was_generated:
                llm_used = True
            cleaning_method = "schema"
            await increment_counter(search_query, miss=(len(specs) == 0))

            # Extract brand keys from schema into taxonomy
            await _extract_and_upsert_brands(category, schema, search_query)

            # Filter harga: jika price di luar range keyword, tandai
            price_range = _PRICE_RANGE_MEMO.get(search_query)
            product_price = row.get("price")
            if price_range and isinstance(product_price, (int, float)) and product_price > 0:
                if product_price < price_range["min"]:
                    cleaning_method = "schema (price_outlier)"
                    category = "outlier"
        else:
            category, _ = detect_category(name, search_query)
            specs = get_parser(category).extract_specs(name)
            cleaning_method = "rule (no_schema)"
    else:
        category, _ = detect_category(name)
        specs = get_parser(category).extract_specs(name)
        cleaning_method = "rule (no_query)"

    # Filter brand: validasi terhadap taxonomy per-kategori
    final_brand = detected_brand or row.get("brand")
    if final_brand and category not in ("generic", "outlier"):
        cat_brands = _TAXONOMY.get(category)
        if cat_brands is not None and final_brand.upper() not in cat_brands:
            cleaning_method = cleaning_method + " (brand_outlier)"
            category = "outlier"
            detected_brand = None
    elif not final_brand and category not in ("generic", "outlier"):
        cat_brands = _TAXONOMY.get(category)
        if cat_brands is not None:
            cleaning_method = cleaning_method + " (no_brand)"
            category = "outlier"

    payload: dict[str, Any] = {
        "category": category,
        "specs": specs or {},
        "cleaning_status": "done",
        "cleaning_method": cleaning_method,
        "llm_used": llm_used,
    }
    if detected_brand and not row.get("brand"):
        payload["brand"] = detected_brand

    return payload