"""Category detection: pakai DETECT_KEYWORDS skor tertinggi.

Return (category_name, confidence_score). Threshold rendah → trigger LLM fallback.
"""
from __future__ import annotations
from .categories import REGISTRY


def detect_category(name: str, search_query: str | None = None) -> tuple[str, int]:
    """Deteksi kategori dari nama produk + (optional) search_query yang dipakai user.

    Strategy:
    1. Skor tiap kategori (selain 'generic') berdasarkan jumlah keyword match
    2. Tambah skor +2 kalau search_query mengandung keyword kategori
    3. Pilih kategori dengan skor tertinggi (>=1), jika tidak ada → 'generic'
    """
    if not name:
        return "generic", 0

    text = name.lower()
    query_text = (search_query or "").lower()

    best_cat = "generic"
    best_score = 0

    for cat, parser in REGISTRY.items():
        if cat == "generic":
            continue
        score = parser.detect_score(text)
        # Boost kalau search_query mengandung keyword kategori
        if query_text:
            for kw in parser.DETECT_KEYWORDS:
                if kw.lower() in query_text:
                    score += 2
                    break
        if score > best_score:
            best_score = score
            best_cat = cat

    if best_score == 0:
        return "generic", 0
    return best_cat, best_score
