"""Smartphone spec parser."""
from __future__ import annotations
import re
from typing import Any
from .base import BaseCategoryParser


class SmartphoneParser(BaseCategoryParser):
    CATEGORY = "smartphone"
    DETECT_KEYWORDS = [
        "smartphone", "handphone", "hp", "iphone", "android", "ios",
        "galaxy", "redmi", "xiaomi", "oppo", "vivo", "realme", "poco",
        "infinix", "tecno", "5g", "4g", "lte",
    ]

    # RAM + Storage often combined: "8GB/256GB", "8/256", "8+256"
    RAM_STORAGE_COMBO_RE = re.compile(
        r"\b(\d{1,3})\s*(?:gb)?\s*[/+]\s*(\d{2,4})\s*(gb|tb)\b",
        re.IGNORECASE,
    )
    RAM_RE = re.compile(r"\b(?:ram\s+)?(\d{1,3})\s*gb\s+ram\b", re.IGNORECASE)
    STORAGE_RE = re.compile(r"\b(\d{2,4})\s*(gb|tb)\s+(?:rom|storage|internal)\b", re.IGNORECASE)

    # Chipset
    CHIPSET_RE = re.compile(
        r"\b("
        r"snapdragon\s+\d+\s*(?:gen\s*\d+)?(?:\+|plus)?"
        r"|sd\d+"
        r"|dimensity\s+\d+(?:\+|plus)?"
        r"|helio\s+[a-z]?\d+"
        r"|exynos\s+\d+"
        r"|kirin\s+\d+"
        r"|tensor\s*(?:g\d)?"
        r"|apple\s+a\d+\s*(?:bionic|pro)?"
        r"|mediatek\s+\w+"
        r"|unisoc\s+\w+"
        r")\b",
        re.IGNORECASE,
    )

    # Camera MP
    CAMERA_RE = re.compile(r"\b(\d{2,3})\s*mp\b", re.IGNORECASE)
    # Battery mAh
    BATTERY_RE = re.compile(r"\b(\d{4,5})\s*mah\b", re.IGNORECASE)
    # Network
    NETWORK_RE = re.compile(r"\b(5g|4g|lte|3g)\b", re.IGNORECASE)
    # Refresh rate
    REFRESH_RE = re.compile(r"\b(\d{2,3})\s*hz\b", re.IGNORECASE)

    def extract_specs(self, name: str) -> dict[str, Any]:
        specs: dict[str, Any] = {}

        m = self.RAM_STORAGE_COMBO_RE.search(name)
        if m:
            ram_gb = int(m.group(1))
            storage_val = int(m.group(2))
            storage_unit = m.group(3).lower()
            # Sanity: RAM <= 32GB biasanya, Storage >= 32GB
            if ram_gb <= 32 and storage_val >= 16:
                specs["ram_gb"] = ram_gb
                specs["storage_gb"] = storage_val * 1024 if storage_unit == "tb" else storage_val
        else:
            m = self.RAM_RE.search(name)
            if m:
                specs["ram_gb"] = int(m.group(1))
            m = self.STORAGE_RE.search(name)
            if m:
                val = int(m.group(1))
                specs["storage_gb"] = val * 1024 if m.group(2).lower() == "tb" else val

        m = self.CHIPSET_RE.search(name)
        if m:
            specs["chipset"] = re.sub(r"\s+", " ", m.group(1)).strip()

        # Multi-camera support: ambil yang terbesar
        cams = [int(x) for x in self.CAMERA_RE.findall(name)]
        if cams:
            specs["camera_mp_max"] = max(cams)
            if len(cams) > 1:
                specs["camera_setup_mp"] = sorted(cams, reverse=True)

        m = self.BATTERY_RE.search(name)
        if m:
            specs["battery_mah"] = int(m.group(1))

        m = self.NETWORK_RE.search(name)
        if m:
            specs["network"] = m.group(1).upper()

        m = self.REFRESH_RE.search(name)
        if m:
            specs["refresh_rate_hz"] = int(m.group(1))

        return specs
