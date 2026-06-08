"""Generic fallback parser — extract common numeric specs."""
from __future__ import annotations
import re
from typing import Any
from .base import BaseCategoryParser


class GenericParser(BaseCategoryParser):
    CATEGORY = "generic"
    DETECT_KEYWORDS: list[str] = []  # never auto-detected; only fallback

    UNIT_RE = re.compile(
        r"\b(\d{1,4}(?:[.,]\d{1,2})?)\s*"
        r"(gb|tb|mb|kb|ghz|mhz|hz|w|v|mah|ml|liter|l|gram|gr|g|kg|cm|mm|inch|in)\b",
        re.IGNORECASE,
    )

    def extract_specs(self, name: str) -> dict[str, Any]:
        specs: dict[str, Any] = {}
        # Collect all numeric+unit pairs sebagai array generik
        matches = self.UNIT_RE.findall(name)
        if matches:
            specs["raw_measurements"] = [
                {"value": self._to_float(v), "unit": u.lower()} for v, u in matches
            ]
        return specs
