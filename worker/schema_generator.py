"""Schema generator: panggil DeepSeek 1× per keyword untuk generate comprehensive
regex + fuzzy match rules. Hasil di-cache di Supabase `keyword_schemas`.
"""
from __future__ import annotations
import asyncio
import json
import logging
from typing import Any
from openai import AsyncOpenAI, RateLimitError, APITimeoutError, APIError

from .config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL

logger = logging.getLogger(__name__)

_client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)


SCHEMA_GEN_PROMPT = """Anda expert e-commerce Indonesia (Shopee). Diberikan keyword + contoh nama produk, generate schema JSON KOMPREHENSIF.

Output WAJIB JSON valid:
{
  "category": "<laptop|smartphone|audio|tv|fashion|kitchen|kosmetik|generic|...>",
  "brands": { "BrandCanonical": ["alias", "typo"], ... },
  "brand_blacklist": ["KABEL", "CHARGER", "CASE", "STAND", ...],
  "model_families": ["TUF", "ROG", ...],
  "spec_patterns": {
    "cpu":           "regex Python — capture VALUE di group 1",
    "ram_gb":        "regex",
    "storage_gb":    "regex",
    ...
  },
  "spec_value_types": { "cpu": "str", "ram_gb": "int", ... }
}

brand_blacklist: daftar kata UPPERCASE yang SERING muncul di nama produk keyword ini tapi BUKAN brand. Contoh untuk keyword "laptop": ["KABEL","CHARGER","CASE","STAND","COOLING","HEADSET","WEBCAM","MEJA","HOLDER","DUDUKAN","ADAPTER","SPEAKER"]. Jangan masukkan brand asli.
ATURAN KRITIS regex Python:
1. WAJIB capture group 1 dengan `()` (BUKAN `(?:)`). Group 1 = nilai yang mau diambil.
2. WAJIB pakai `\\b` di awal/akhir pattern supaya tidak salah match angka random.
3. WAJIB sertakan UNIT WAJIB di pattern. Contoh untuk RAM/Storage/Hz: angka HARUS diikuti unit.
4. Case-insensitive auto-applied. Jangan tulis `(?i)`.

CONTOH BENAR untuk laptop:
- "cpu":             "\\b((?:intel\\s+)?core\\s+i[3579][\\-\\s]?\\d{3,5}[a-z]{0,3}|ryzen\\s+\\d\\s+\\d{4}[a-z]{0,3}|apple\\s+m[1-4](?:\\s+pro|\\s+max|\\s+ultra)?)\\b"
- "gpu":             "\\b((?:nvidia\\s+)?(?:geforce\\s+)?(?:rtx|gtx)\\s*\\d{4}(?:\\s*ti)?|mx\\s*\\d{3}|radeon\\s+(?:rx\\s+)?\\d{3,4}[a-z]?)\\b"
- "ram_gb":          "\\b(?:ram\\s+)?(\\d{1,3})\\s*gb\\s+(?:ram|ddr\\d?|lpddr\\d?|memory)\\b|\\bram\\s+(\\d{1,3})\\s*gb\\b"
- "storage_gb":      "\\b(\\d{2,4})\\s*(?:gb|g)\\s*(?:ssd|nvme|hdd|emmc|m\\.?2)\\b|\\b(?:ssd|nvme|hdd)\\s*(\\d{2,4})\\s*(?:gb|g)\\b|\\b(\\d{1,2})\\s*tb\\s*(?:ssd|nvme|hdd)?\\b"
- "screen_inch":     "\\b(\\d{2}(?:[.,]\\d)?)\\s*(?:inch|in|\\\"|''|\\u201d)\\b"
- "refresh_rate_hz": "\\b(\\d{2,3})\\s*hz\\b"
- "os":              "\\b(win(?:dows)?\\s*(?:11|10)\\s*(?:pro|home)?|chrome\\s*os|mac\\s*os)\\b"

CONTOH SALAH (JANGAN):
- "ram_gb": "(\\d+)\\s*GB"             ← terlalu loose, akan match "8GB" di "RAM 8Gb/16Gb 512GB" duluan
- "storage_gb": "(\\d+)\\s*(?:GB|TB)?" ← UNIT OPSIONAL = catches angka random ("Ryzen 7" → 7!)
- "cpu": "(?:core...)"                  ← non-capture group, no group 1

ATURAN LAIN:
- Brands JANGAN double-listed. Canonical (UPPERCASE atau TitleCase). Alias = typo common.
- model_families: SERIES NAME (TUF, ROG, Galaxy, Redmi Note), JANGAN sama dengan brand. Max 30.
- Untuk smartphone, GUNAKAN pattern combo "8GB/256GB": "\\b(\\d{1,3})\\s*(?:gb)?\\s*[/+]\\s*(\\d{2,4})\\s*(?:gb|tb)\\b" (capture RAM di group 1, storage di group 2).
- HANYA JSON, no markdown wrap, no extra text.
""".strip()


def build_user_prompt(keyword: str, samples: list[dict]) -> str:
    sample_lines = []
    for s in samples[:15]:
        name = s.get("name", "")
        price = s.get("price")
        if price:
            sample_lines.append(f"- {name}  (Rp {price:,})")
        else:
            sample_lines.append(f"- {name}")
    sample_block = "\n".join(sample_lines)
    return (
        f"Keyword: {keyword}\n\n"
        f"Contoh nama produk dari Shopee (search hasil keyword ini):\n{sample_block}\n\n"
        f"Generate schema JSON komprehensif untuk keyword ini."
    )


async def generate_schema(
    keyword: str, sample_names: list[dict]
) -> dict[str, Any]:
    user_msg = build_user_prompt(keyword, sample_names)

    max_retries = 3
    backoff = 2.0
    last_exc: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            response = await _client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[
                    {"role": "system", "content": SCHEMA_GEN_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=2048,
            )
            content = response.choices[0].message.content or "{}"
            data = json.loads(content)

            if "category" not in data:
                raise ValueError("Schema missing 'category' field")
            if "spec_patterns" not in data or not isinstance(
                data["spec_patterns"], dict
            ):
                raise ValueError("Schema missing valid 'spec_patterns'")

            return {
                "schema": data,
                "category": data.get("category", "generic"),
                "usage": response.usage.model_dump() if response.usage else None,
                "model": DEEPSEEK_MODEL,
            }
        except (RateLimitError, APITimeoutError) as e:
            last_exc = e
            logger.warning("DeepSeek schema gen rate/timeout (%d): %s", attempt, e)
            await asyncio.sleep(backoff)
            backoff *= 2
        except APIError as e:
            last_exc = e
            status = getattr(e, "status_code", 0) or 0
            if 500 <= status < 600:
                logger.warning("DeepSeek schema gen 5xx (%d): %s", attempt, e)
                await asyncio.sleep(backoff)
                backoff *= 2
            else:
                logger.error("DeepSeek 4xx, abort: %s", e)
                break
        except (json.JSONDecodeError, ValueError) as e:
            last_exc = e
            logger.error("Schema parse/validation error: %s", e)
            break

    raise last_exc if last_exc else RuntimeError("Schema generation failed")