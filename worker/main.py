"""Main worker entry point.

Run: python -m worker.main
"""
from __future__ import annotations
import asyncio
import logging
import signal

from .config import BATCH_SIZE, MAX_CONCURRENT_LLM, SLEEP_BETWEEN_BATCHES
from .pipeline import process_product
from .supabase_client import fetch_pending, update_row, mark_processing

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("worker")

shutdown_event = asyncio.Event()


def _setup_signal_handlers(loop: asyncio.AbstractEventLoop) -> None:
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, shutdown_event.set)
        except NotImplementedError:
            pass  # Windows


async def process_one_safe(row: dict, semaphore: asyncio.Semaphore) -> None:
    row_id = row["id"]
    async with semaphore:
        try:
            payload = await process_product(row)
            await update_row(row_id, payload)
            specs_count = len(payload.get("specs", {}))
            logger.info(
                "OK id=%s cat=%s specs=%d llm=%s",
                row_id, payload["category"], specs_count, payload["llm_used"],
            )
        except Exception as e:
            logger.exception("FAIL id=%s: %s", row_id, e)
            await update_row(row_id, {
                "cleaning_status": "failed",
                "cleaning_method": f"error: {str(e)[:200]}",
            })


async def main_loop() -> None:
    sem = asyncio.Semaphore(MAX_CONCURRENT_LLM)
    logger.info(
        "Worker started — batch=%d, concurrency=%d, sleep=%.1fs",
        BATCH_SIZE, MAX_CONCURRENT_LLM, SLEEP_BETWEEN_BATCHES,
    )

    while not shutdown_event.is_set():
        try:
            rows = await fetch_pending(BATCH_SIZE)
        except Exception as e:
            logger.exception("Fetch error: %s", e)
            await asyncio.sleep(10)
            continue

        if not rows:
            logger.info("No pending rows. Sleeping 10s...")
            try:
                await asyncio.wait_for(shutdown_event.wait(), timeout=10)
            except asyncio.TimeoutError:
                pass
            continue

        # Mark processing untuk hindari race condition multi-worker
        await mark_processing([r["id"] for r in rows])

        logger.info("Processing batch of %d", len(rows))
        await asyncio.gather(*(process_one_safe(r, sem) for r in rows))

        try:
            await asyncio.wait_for(shutdown_event.wait(), timeout=SLEEP_BETWEEN_BATCHES)
        except asyncio.TimeoutError:
            pass

    logger.info("Worker shutdown gracefully.")


def main() -> None:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    _setup_signal_handlers(loop)
    try:
        loop.run_until_complete(main_loop())
    finally:
        loop.close()


if __name__ == "__main__":
    main()
