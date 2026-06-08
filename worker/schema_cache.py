"""Supabase ops untuk keyword_schemas cache."""
from __future__ import annotations
import asyncio
import logging
from typing import Any
from datetime import datetime, timezone

from .supabase_client import supabase

logger = logging.getLogger(__name__)

SCHEMA_TABLE = "keyword_schemas"


def _get_schema_sync(keyword: str) -> dict[str, Any] | None:
    resp = (
        supabase.table(SCHEMA_TABLE)
        .select("*")
        .eq("keyword", keyword)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None


async def get_schema(keyword: str) -> dict[str, Any] | None:
    return await asyncio.to_thread(_get_schema_sync, keyword)


def _save_schema_sync(
    keyword: str,
    category: str,
    schema: dict[str, Any],
    sample_names: list[str],
    tokens_used: int,
    model: str,
) -> None:
    payload = {
        "keyword": keyword,
        "category": category,
        "schema": schema,
        "sample_names": sample_names,
        "llm_tokens_used": tokens_used,
        "llm_model": model,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
    }
    # Upsert by keyword
    supabase.table(SCHEMA_TABLE).upsert(payload, on_conflict="keyword").execute()


async def save_schema(
    keyword: str,
    category: str,
    schema: dict[str, Any],
    sample_names: list[str],
    tokens_used: int,
    model: str,
) -> None:
    await asyncio.to_thread(
        _save_schema_sync, keyword, category, schema, sample_names, tokens_used, model
    )


def _increment_counter_sync(keyword: str, miss: bool = False) -> None:
    # Atomic increment via RPC bisa, tapi cukup pakai update +1 sederhana
    col = "miss_count" if miss else "product_count"
    try:
        resp = supabase.table(SCHEMA_TABLE).select(col).eq("keyword", keyword).limit(1).execute()
        if not resp.data:
            return
        current = resp.data[0].get(col, 0) or 0
        supabase.table(SCHEMA_TABLE).update({col: current + 1}).eq("keyword", keyword).execute()
    except Exception as e:
        logger.debug("Counter inc skipped: %s", e)


async def increment_counter(keyword: str, miss: bool = False) -> None:
    await asyncio.to_thread(_increment_counter_sync, keyword, miss)


def _fetch_samples_sync(keyword: str, limit: int = 12) -> list[str]:
    """Ambil sample nama produk dari keyword tertentu untuk schema generation."""
    resp = (
        supabase.table("shopee_products")
        .select("product_name, name_raw")
        .eq("search_query", keyword)
        .limit(limit)
        .execute()
    )
    names = []
    for r in resp.data or []:
        n = r.get("name_raw") or r.get("product_name")
        if n:
            names.append(n)
    return names


async def fetch_samples(keyword: str, limit: int = 12) -> list[str]:
    return await asyncio.to_thread(_fetch_samples_sync, keyword, limit)
