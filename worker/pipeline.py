"""Pipeline v4: schema-per-keyword (rule-first, NO per-product LLM call).

Workflow:
1. Untuk row: ambil search_query
2. Cek cache `keyword_schemas[search_query]`:
   - HIT  → apply schema (regex + rapidfuzz) → DONE (no LLM)
   - MISS → generate schema via DeepSeek 1×, cache, lalu apply

Hasil: 1 LLM call per UNIQUE keyword, bukan per produk.
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

# In-memory cache schema selama 1 run worker (avoid hit Supabase tiap produk)
_SCHEMA_MEMO: dict[str, dict[str, Any]] = {}
_GENERATING: dict[str, asyncio.Lock] = {}
_GLOBAL_LOCK = asyncio.Lock()


async def _get_or_generate_schema(keyword: str) -> dict[str, Any] | None:
    """Lazy load schema. Generate via DeepSeek kalau belum cached."""
    if keyword in _SCHEMA_MEMO:
        return _SCHEMA_MEMO[keyword]

    # Per-keyword lock supaya kalau 5 task butuh schema yang sama, hanya 1 yang call LLM
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
            _SCHEMA_MEMO[keyword] = cached["schema"]
            return cached["schema"]

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

            await save_schema(
                keyword=keyword,
                category=category,
                schema=schema,
                sample_names=samples,
                tokens_used=tokens,
                model=model,
            )
            logger.info(
                "Schema generated & cached: keyword=%s, category=%s, tokens=%d",
                keyword, category, tokens,
            )
            _SCHEMA_MEMO[keyword] = schema
            return schema
        except Exception as e:
            logger.exception("Schema generation failed for %s: %s", keyword, e)
            return None


async def process_product(row: dict[str, Any]) -> dict[str, Any]:
    """Process 1 product. Pakai cached schema (atau generate sekali kalau keyword baru)."""
    name = row.get("product_name") or row.get("name_raw") or ""
    search_query = (row.get("search_query") or "").strip()

    # Default fallback specs via built-in rule-based parser (kalau tidak ada keyword)
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
            # Track LLM usage (kalau schema baru di-generate di run ini)
            # Tidak ada per-product LLM call lagi
            await increment_counter(search_query, miss=(len(specs) == 0))
        else:
            # Fallback ke built-in parser
            category, _ = detect_category(name, search_query)
            specs = get_parser(category).extract_specs(name)
            cleaning_method = "rule (no_schema)"
    else:
        category, _ = detect_category(name)
        specs = get_parser(category).extract_specs(name)
        cleaning_method = "rule (no_query)"

    # Merge brand dari schema kalau row.brand kosong (jangan override hasil inject.js)
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
