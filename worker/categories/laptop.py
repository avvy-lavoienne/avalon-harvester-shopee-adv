"""Laptop spec parser."""
from __future__ import annotations
import re
from typing import Any
from .base import BaseCategoryParser


class LaptopParser(BaseCategoryParser):
    CATEGORY = "laptop"
    DETECT_KEYWORDS = [
        "laptop", "notebook", "macbook", "ultrabook", "chromebook",
        "thinkpad", "vivobook", "ideapad", "victus", "legion", "rog",
        "tuf", "predator", "nitro", "aspire", "loq", "zenbook",
    ]

    # CPU patterns (Intel + AMD + Apple)
    # Strict: harus ada keyword Intel/Core/Ryzen/AMD/M-chip/Snapdragon supaya tidak salah match GPU
    CPU_RE = re.compile(
        r"\b("
        r"(?:intel\s+)?core\s*[im][3579][\-\s]*\d{3,5}[a-z]{0,3}"  # Core i5-1235U, Core i7 13620H
        r"|core\s+\d\s+\d{3,5}[a-z]{0,3}"  # Core 5 210H, Core 7 240H
        r"|[im][3579][\-\s]+\d{3,5}[a-z]{0,3}"  # i5-1235U, i7 13620H (must have separator)
        r"|ryzen\s+\d\s+(?:pro\s+)?\d{3,4}[a-z]{0,3}"  # Ryzen 7 7445HS
        r"|ryzen\s+\d\s+pro"  # Ryzen 7 Pro
        r"|ryzen\s+\d\b"
        r"|amd\s+ryzen\s+\d(?:\s+\d{3,4}[a-z]{0,3})?"
        r"|apple\s+m[1-4]\s*(?:pro|max|ultra)?"
        r"|m[1-4]\s*(?:pro|max|ultra)\b"
        r"|snapdragon\s+x\s*(?:elite|plus|\w+)"
        r")\b",
        re.IGNORECASE,
    )

    # GPU patterns
    GPU_RE = re.compile(
        r"\b("
        r"rtx\s*\d{4}(?:\s*ti)?"  # RTX 3050 / RTX 4060 Ti
        r"|gtx\s*\d{3,4}(?:\s*ti)?"
        r"|mx\d{3}"
        r"|radeon\s+(?:rx\s+)?\d{3,4}[a-z]?"
        r"|iris\s+xe?(?:\s+graphics)?"
        r"|geforce\s+(?:rtx|gtx)?\s*\d{4}"
        r"|arc\s+a\d{3}"
        r"|uhd\s+graphics"
        r"|vega\s+\d+"
        r")\b",
        re.IGNORECASE,
    )

    # RAM — strict: harus disertai keyword RAM atau DDR
    RAM_RE = re.compile(
        r"\b(?:ram\s+)?(\d{1,3})\s*(?:gb|g)(?:\s+ram|\s+(?:ddr|lpddr)\d*|\s+memory)\b",
        re.IGNORECASE,
    )
    # Fallback: kalau tidak ada keyword, ambil angka yang masuk akal untuk RAM (4/6/8/12/16/24/32/48/64)
    RAM_FALLBACK_RE = re.compile(r"\b(4|6|8|12|16|24|32|48|64|96|128)\s*gb\b(?!\s*(?:ssd|hdd|storage|emmc|nvme|flash|rom|gpu|gddr|vram|tb))", re.IGNORECASE)

    # Storage
    SSD_RE = re.compile(r"\b(\d{2,4})\s*(gb|tb)\s*(?:ssd|nvme|m\.?2|pcie)\b", re.IGNORECASE)
    SSD_ALT_RE = re.compile(r"\b(?:ssd|nvme|m\.?2)\s*(\d{2,4})\s*(gb|tb)\b", re.IGNORECASE)
    HDD_RE = re.compile(r"\b(\d{2,4})\s*(gb|tb)\s*(?:hdd|harddisk)\b", re.IGNORECASE)

    # Screen
    SCREEN_INCH_RE = re.compile(r"\b(\d{2}(?:[.,]\d)?)\s*(?:inch|in|\"|''|\u201d)\b", re.IGNORECASE)
    SCREEN_HZ_RE = re.compile(r"\b(\d{2,3})\s*hz\b", re.IGNORECASE)
    RESOLUTION_RE = re.compile(r"\b(fhd\+?|qhd\+?|uhd|wuxga|wqhd|wqxga|2k|4k|8k|hd\+?|oled|amoled|ips|va|tn)\b", re.IGNORECASE)

    OS_RE = re.compile(r"\b(win(?:dows)?\s*(?:11|10|8|7)\s*(?:pro|home|enterprise|edu)?|chrome\s*os|mac\s*os|ubuntu|linux|free\s*dos)\b", re.IGNORECASE)

    def extract_specs(self, name: str) -> dict[str, Any]:
        specs: dict[str, Any] = {}

        # CPU
        m = self.CPU_RE.search(name)
        if m:
            specs["cpu"] = self._normalize_spaces(m.group(1))

        # GPU
        m = self.GPU_RE.search(name)
        if m:
            specs["gpu"] = self._normalize_spaces(m.group(1)).upper()

        # RAM — prefer RAM_RE (explicit), fallback ambil VALUE TERBESAR yang valid
        m = self.RAM_RE.search(name)
        if m:
            specs["ram_gb"] = int(m.group(1))
        else:
            matches = [int(x) for x in self.RAM_FALLBACK_RE.findall(name)]
            if matches:
                ge8 = [v for v in matches if 8 <= v <= 128]
                specs["ram_gb"] = max(ge8) if ge8 else max(matches)

        # SSD storage
        m = self.SSD_RE.search(name) or self.SSD_ALT_RE.search(name)
        if m:
            val, unit = int(m.group(1)), m.group(2).lower()
            specs["storage_gb"] = val * 1024 if unit == "tb" else val
            specs["storage_type"] = "SSD"
        else:
            m = self.HDD_RE.search(name)
            if m:
                val, unit = int(m.group(1)), m.group(2).lower()
                specs["storage_gb"] = val * 1024 if unit == "tb" else val
                specs["storage_type"] = "HDD"

        # Screen
        m = self.SCREEN_INCH_RE.search(name)
        if m:
            specs["screen_inch"] = self._to_float(m.group(1))

        m = self.SCREEN_HZ_RE.search(name)
        if m:
            specs["refresh_rate_hz"] = int(m.group(1))

        m = self.RESOLUTION_RE.search(name)
        if m:
            specs["display_type"] = m.group(1).upper()

        m = self.OS_RE.search(name)
        if m:
            specs["os"] = self._normalize_spaces(m.group(1))

        return specs

    @staticmethod
    def _normalize_spaces(s: str) -> str:
        return re.sub(r"\s+", " ", s).strip()
