"""DeepSeek LLM client (OpenAI-compatible) — fallback untuk categorize + extract spec."""
from __future__ import annotations
import json
import logging
import asyncio
from openai import AsyncOpenAI, RateLimitError, APITimeoutError, APIError

from .config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

SYSTEM_PROMPT = """Anda asisten klasifikasi produk e-commerce Indonesia (Shopee).
Tugas:
1. Tentukan kategori produk DARI LIST: laptop, smartphone, audio, tv, fashion, generic.
2. Ekstrak spesifikasi penting dari nama produk.

Aturan output (HARUS JSON valid):
{
  "category": "<salah satu dari list>",
  "specs": {
    "brand": "string atau null",
    "model": "string atau null",
    "<spec_key>": "<value>"
    ...
  }
}

- "specs" boleh berisi field bebas relevan (cpu, gpu, ram_gb, storage_gb, screen_inch,
  refresh_rate_hz, chipset, camera_mp_max, battery_mah, size, color, dll).
- Field tidak diketahui → JANGAN dimasukkan (skip).
- Angka harus berupa number, bukan string.
- Jangan tulis teks apa pun di luar JSON.""".strip()


async def classify_with_llm(product_name: str, hint_category: str | None = None) -> dict:
    """Panggil DeepSeek untuk categorize + extract spec.

    Returns dict {category, specs, usage} atau raises Exception.
    """
    user_msg = f"Nama produk: {product_name}"
    if hint_category and hint_category != "generic":
        user_msg += f"\nHint kategori (boleh override): {hint_category}"

    max_retries = 3
    backoff = 1.0
    last_exc: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            response = await client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=512,
            )
            content = response.choices[0].message.content or "{}"
            data = json.loads(content)
            return {
                "category": data.get("category", "generic"),
                "specs": data.get("specs", {}) or {},
                "usage": response.usage.model_dump() if response.usage else None,
            }
        except (RateLimitError, APITimeoutError) as e:
            last_exc = e
            logger.warning("DeepSeek rate/timeout (attempt %d): %s", attempt, e)
            await asyncio.sleep(backoff)
            backoff *= 2
        except APIError as e:
            last_exc = e
            status = getattr(e, "status_code", 0) or 0
            if 500 <= status < 600:
                logger.warning("DeepSeek 5xx (attempt %d): %s", attempt, e)
                await asyncio.sleep(backoff)
                backoff *= 2
            else:
                logger.error("DeepSeek 4xx, abort retry: %s", e)
                break
        except json.JSONDecodeError as e:
            last_exc = e
            logger.error("DeepSeek JSON parse error: %s", e)
            break

    raise last_exc if last_exc else RuntimeError("DeepSeek unknown error")
