"""Pipeline: 1 produk → category detection → rule-based parse → fallback LLM."""
from __future__ import annotations
import logging
from typing import Any

from .categories import REGISTRY, get_parser
from .category_detector import detect_category
from .deepseek_client import classify_with_llm
from .config import LLM_FALLBACK_ENABLED

logger = logging.getLogger(__name__)

# Threshold: kalau rule-based extract < N specs, fallback ke LLM
MIN_SPECS_THRESHOLD = 2


async def process_product(row: dict[str, Any]) -> dict[str, Any]:
    """Process 1 product row. Return payload untuk UPDATE Supabase.

    Logic:
    1. Detect category dari name + search_query
    2. Rule-based extract specs
    3. Kalau specs < threshold ATAU category=generic → call DeepSeek
    4. Return payload dengan {category, specs, cleaning_method, llm_used, ...}
    """
    name = row.get("product_name") or row.get("name_raw") or ""
    search_query = row.get("search_query")

    # 1. Detect category
    category, score = detect_category(name, search_query)

    # 2. Rule-based extract
    parser = get_parser(category)
    specs = parser.extract_specs(name)

    cleaning_method = "rule"
    llm_used = False

    # 3. Fallback ke LLM
    needs_llm = (
        LLM_FALLBACK_ENABLED
        and (category == "generic" or len(specs) < MIN_SPECS_THRESHOLD)
    )

    if needs_llm:
        try:
            llm_result = await classify_with_llm(name, hint_category=category)
            llm_category = llm_result["category"]
            llm_specs = llm_result["specs"]

            # Kalau LLM yakin kategori beda → re-parse rule-based untuk kategori baru,
            # gabung dengan spec dari LLM
            if llm_category != category and llm_category in REGISTRY:
                category = llm_category
                rule_specs = get_parser(llm_category).extract_specs(name)
                specs = {**rule_specs, **llm_specs}  # LLM override rule
            else:
                specs = {**specs, **llm_specs}

            cleaning_method = "rule+llm"
            llm_used = True
        except Exception as e:
            logger.warning("LLM fallback failed for %s: %s", row.get("id"), e)
            cleaning_method = "rule (llm_failed)"

    payload = {
        "category": category,
        "category_score": score,
        "specs": specs or {},
        "cleaning_status": "done",
        "cleaning_method": cleaning_method,
        "llm_used": llm_used,
    }
    return payload
