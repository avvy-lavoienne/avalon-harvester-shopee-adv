"""Pipeline v4: schema-per-keyword (rule-first, NO per-product LLM call).

Workflow:
1. Untuk row: ambil search_query
2. Cek cache `keyword_schemas[search_query]`:
   - HIT  → apply schema (regex + rapidfuzz) → DONE (no LLM)
   - MISS → generate schema via DeepSeek 1×, cache, lalu apply

Hasil: 1 LLM call per UNIQUE keyword, bukan per produk.
Harga: price_range dihitung empiris dari sample (P5-P95), tanpa LLM.
"""
from __future__ import annotations
import asyncio
import logging
from typing import Any

from .schema_engine import apply_schema
from .schema_cache import get_schema, save_schema, fetch_samples, increment_counter
from .schema_generator import generate_schema
from .categories import get_parser
from .category_detector import detect_category

logger = logging.getLogger(__name__)

_SCHEMA_MEMO: dict[str, dict[str, Any]] = {}
_PRICE_RANGE_MEMO: dict[str, dict[str, int] | None] = {}
_GENERATING: dict[str, asyncio.Lock] = {}
_GLOBAL_LOCK = asyncio.Lock()


def _calc_price_range(samples: list[dict]) -> dict[str, int] | None:
    """Hitung P5 dan P95 dari sample prices."""
    prices = [s["price"] for s in samples if isinstance(s.get("price"), (int, float)) and s["price"] > 0]
    if len(prices) < 3:
        return None
    prices.sort()
    p5 = prices[max(0, int(len(prices) * 0.05))]
    p95 = prices[min(len(prices) - 1, int(len(prices) * 0.95))]
    return {"min": p5, "max": p95}


async def _get_or_generate_schema(keyword: str) -> dict[str, Any] | None:
    if keyword in _SCHEMA_MEMO:
        return _SCHEMA_MEMO[keyword]

    async with _GLOBAL_LOCK:
        if keyword not in _GENERATING:
            _GENERATING[keyword] = asyncio.Lock()
        keyword_lock = _GENERATING[keyword]

    async with keyword_lock:
        if keyword in _SCHEMA_MEMO:
            return _SCHEMA_MEMO[keyword]

        # 1. Check Supabase cache
        cached = await get_schema(keyword)
        if cached and cached.get("schema"):
            logger.info("Schema cache HIT: %s (cat=%s)", keyword, cached.get("category"))
            schema = cached["schema"]
            _SCHEMA_MEMO[keyword] = schema
            # Hitung price_range dari sample terkini
            samples = await fetch_samples(keyword, limit=30)
            _PRICE_RANGE_MEMO[keyword] = _calc_price_range(samples)
            return schema

        # 2. Cache miss → generate via DeepSeek
        logger.info("Schema cache MISS, generating for: %s", keyword)
        samples = await fetch_samples(keyword, limit=12)
        if not samples:
            logger.warning("No sample products for keyword=%s, skip generate", keyword)
            return None

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
            return schema
        except Exception as e:
            logger.exception("Schema generation failed for %s: %s", keyword, e)
            return None


async def process_product(row: dict[str, Any]) -> dict[str, Any]:
    name = row.get("product_name") or row.get("name_raw") or ""
    search_query = (row.get("search_query") or "").strip()

    specs: dict[str, Any] = {}
    category = "generic"
    cleaning_method = "rule"
    llm_used = False
    detected_brand: str | None = None

    if search_query:
        schema = await _get_or_generate_schema(search_query)
        if schema:
            category = schema.get("category", "generic")
            detected_brand, specs = apply_schema(name, schema)
            cleaning_method = "schema"
            await increment_counter(search_query, miss=(len(specs) == 0))

            # Filter harga: jika price di luar range keyword, tandai
            price_range = _PRICE_RANGE_MEMO.get(search_query)
            product_price = row.get("price")
            if price_range and isinstance(product_price, (int, float)) and product_price > 0:
                if product_price < price_range["min"] or product_price > price_range["max"]:
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