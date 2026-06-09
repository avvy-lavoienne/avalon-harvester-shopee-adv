"""Supabase ops untuk worker — sync wrapped in asyncio.to_thread."""
from __future__ import annotations
import asyncio
import logging
import time
from typing import Any
from supabase import create_client, Client

from .config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_TABLE,
)

logger = logging.getLogger(__name__)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

try:
    import httpx
    _RETRYABLE = (httpx.ReadError, httpx.TimeoutException, httpx.ConnectError)
except ImportError:
    _RETRYABLE = ()

MAX_RETRIES = 3
RETRY_DELAY = 1.0


def _fetch_pending_sync(limit: int) -> list[dict[str, Any]]:
    resp = (
        supabase.table(SUPABASE_TABLE)
        .select("id, item_id, product_name, name_raw, brand, search_query, cleaning_status")
        .or_("cleaning_status.is.null,cleaning_status.eq.pending")
        .limit(limit)
        .execute()
    )
    return resp.data or []


async def fetch_pending(limit: int) -> list[dict[str, Any]]:
    return await asyncio.to_thread(_fetch_pending_sync, limit)


def _update_row_sync(row_id: str, payload: dict[str, Any]) -> None:
    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            supabase.table(SUPABASE_TABLE).update(payload).eq("id", row_id).execute()
            return
        except _RETRYABLE as e:
            last_exc = e
            logger.warning("Update row retry %d/%d for %s: %s", attempt, MAX_RETRIES, row_id, e)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
    if last_exc:
        raise last_exc


async def update_row(row_id: str, payload: dict[str, Any]) -> None:
    await asyncio.to_thread(_update_row_sync, row_id, payload)


def _mark_processing_sync(row_ids: list[str]) -> None:
    if not row_ids:
        return
    supabase.table(SUPABASE_TABLE).update({"cleaning_status": "processing"}).in_(
        "id", row_ids
    ).execute()


async def mark_processing(row_ids: list[str]) -> None:
    await asyncio.to_thread(_mark_processing_sync, row_ids)