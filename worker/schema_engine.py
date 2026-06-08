"""Schema engine: pakai schema (cached/generated) untuk extract specs dengan regex + rapidfuzz.

Tidak butuh DeepSeek lagi setelah schema cached.
"""
from __future__ import annotations
import re
import logging
from typing import Any

try:
    from rapidfuzz import fuzz, process
    HAS_RAPIDFUZZ = True
except ImportError:
    HAS_RAPIDFUZZ = False

logger = logging.getLogger(__name__)


def _parse_value(raw: str, value_type: str, field: str = "", context: str = "") -> Any:
    """Parse captured regex string sesuai tipe yang dideklarasikan di schema.

    Special handling:
    - field='storage_gb': cek context untuk TB suffix → multiply 1024
    """
    raw = raw.strip()
    if not raw:
        return None

    # Storage TB-aware
    if field == "storage_gb" and value_type == "int":
        try:
            val = int(re.sub(r"[^\d\-]", "", raw))
        except ValueError:
            return None
        # Cek apakah captured value ada di context dengan suffix TB
        if context:
            tb_pattern = re.compile(
                rf"\b{re.escape(str(val))}\s*tb\b", re.IGNORECASE
            )
            if tb_pattern.search(context):
                return val * 1024
        return val

    if value_type == "int":
        try:
            return int(re.sub(r"[^\d\-]", "", raw))
        except ValueError:
            return None
    if value_type == "float":
        try:
            return float(raw.replace(",", "."))
        except ValueError:
            return None
    if value_type == "bool":
        return True
    return re.sub(r"\s+", " ", raw).strip()


def detect_brand_fuzzy(
    name: str,
    brand_map: dict[str, list[str]],
    threshold: int = 85,
) -> str | None:
    """Detect brand dari name. Strategy:
    1. Exact match (case-insensitive, word boundary) untuk canonical & alias
    2. Fallback fuzzy match dengan rapidfuzz token_set_ratio

    Args:
        name: nama produk
        brand_map: {canonical: [aliases]}
        threshold: skor fuzzy minimum (0-100)
    """
    if not name or not brand_map:
        return None

    name_lower = name.lower()
    # 1. Exact substring match (canonical + alias)
    for canonical, aliases in brand_map.items():
        candidates = [canonical] + (aliases or [])
        for cand in candidates:
            if not cand:
                continue
            # Word boundary match, case-insensitive
            pattern = r"\b" + re.escape(cand.lower()) + r"\b"
            if re.search(pattern, name_lower):
                return canonical

    # 2. Fuzzy fallback (kalau rapidfuzz tersedia)
    if HAS_RAPIDFUZZ:
        # Ambil 1-3 kata pertama produk sebagai candidate brand
        first_words = " ".join(name.split()[:3])
        all_candidates: list[tuple[str, str]] = []  # (alias, canonical)
        for canonical, aliases in brand_map.items():
            all_candidates.append((canonical, canonical))
            for a in aliases or []:
                if a:
                    all_candidates.append((a, canonical))
        if all_candidates:
            best = process.extractOne(
                first_words,
                [c[0] for c in all_candidates],
                scorer=fuzz.token_set_ratio,
                score_cutoff=threshold,
            )
            if best:
                idx = best[2]
                return all_candidates[idx][1]
    return None


def _sanity_ok(field: str, value: Any) -> bool:
    """Reject impossible captured values per known field."""
    if field == "ram_gb" and isinstance(value, int):
        return 2 <= value <= 256
    if field == "storage_gb" and isinstance(value, int):
        return value >= 16
    if field == "screen_inch" and isinstance(value, (int, float)):
        return 5 <= value <= 100
    if field == "refresh_rate_hz" and isinstance(value, int):
        return 30 <= value <= 540
    if field in ("battery_mah",) and isinstance(value, int):
        return 1000 <= value <= 25000
    return True


def _extract_first_valid_group(m: re.Match) -> str | None:
    """Ambil group 1 yang non-empty, fallback ke group 2, 3, dst, finally group 0."""
    if not m:
        return None
    try:
        for i in range(1, (m.lastindex or 0) + 1):
            try:
                g = m.group(i)
                if g:
                    return g
            except IndexError:
                continue
    except (IndexError, AttributeError):
        pass
    try:
        return m.group(0)
    except IndexError:
        return None


def apply_schema(
    name: str, schema: dict[str, Any]
) -> tuple[str | None, dict[str, Any]]:
    """Apply schema (dari cache) ke nama produk → return (brand, specs)."""
    specs: dict[str, Any] = {}
    if not name:
        return None, specs

    # 1. Brand detection (exact + fuzzy)
    brand_map = schema.get("brands", {}) or {}
    brand = detect_brand_fuzzy(name, brand_map)

    # 2. Spec extraction via regex patterns
    patterns = schema.get("spec_patterns", {}) or {}
    value_types = schema.get("spec_value_types", {}) or {}

    for field, pattern_str in patterns.items():
        if not isinstance(pattern_str, str):
            continue
        try:
            pattern = re.compile(pattern_str, re.IGNORECASE)
        except re.error as e:
            logger.warning("Invalid regex for %s: %s | err=%s", field, pattern_str, e)
            continue

        # Coba ALL matches, ambil yang lolos sanity check
        best_value: Any = None
        for m in pattern.finditer(name):
            captured = _extract_first_valid_group(m)
            if not captured:
                continue
            vtype = value_types.get(field, "str")
            parsed = _parse_value(captured, vtype, field=field, context=name)
            if parsed is None or parsed == "":
                continue
            if not _sanity_ok(field, parsed):
                logger.debug("Sanity reject %s=%s for: %s", field, parsed, name[:60])
                continue
            # Untuk numeric: ambil yang TERBESAR (sering RAM>VRAM, Storage>RAM)
            if isinstance(parsed, (int, float)):
                if best_value is None or parsed > best_value:
                    best_value = parsed
            else:
                # str: ambil yang pertama match valid
                if best_value is None:
                    best_value = parsed

        if best_value is not None:
            specs[field] = best_value

    # 3. Detect model family (skip kalau sama dengan brand)
    model_families = schema.get("model_families", []) or []
    if model_families:
        brand_lower = (brand or "").lower()
        for mf in model_families:
            if not mf or str(mf).lower() == brand_lower:
                continue
            pattern = r"\b" + re.escape(str(mf).lower()) + r"\b"
            if re.search(pattern, name.lower()):
                specs.setdefault("model_family", mf)
                break

    return brand, specs
