"""Abstract base parser. Tiap kategori implementasi `extract_specs`."""
from __future__ import annotations
import re
from typing import Any


class BaseCategoryParser:
    """Base class untuk parser per kategori.

    Subclass override:
    - DETECT_KEYWORDS: kata kunci untuk auto-detect kategori
    - extract_specs(name): return dict spec terstruktur
    """

    CATEGORY: str = "generic"
    DETECT_KEYWORDS: list[str] = []

    def detect_score(self, name: str) -> int:
        """Hitung skor kemungkinan name termasuk kategori ini.
        Default: jumlah kata kunci yang match.
        """
        if not name:
            return 0
        lower = name.lower()
        return sum(1 for kw in self.DETECT_KEYWORDS if kw.lower() in lower)

    def extract_specs(self, name: str) -> dict[str, Any]:
        """Return dict spec dari nama produk. Default empty (subclass override)."""
        return {}

    # ---------- helpers untuk subclass ----------
    @staticmethod
    def _first(pattern: str, text: str, group: int = 1, flags: int = re.IGNORECASE) -> str | None:
        m = re.search(pattern, text, flags)
        return m.group(group).strip() if m else None

    @staticmethod
    def _to_int(s: str | None) -> int | None:
        if not s:
            return None
        try:
            return int(re.sub(r"[^\d]", "", s))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _to_float(s: str | None) -> float | None:
        if not s:
            return None
        try:
            return float(s.replace(",", "."))
        except (ValueError, TypeError):
            return None
