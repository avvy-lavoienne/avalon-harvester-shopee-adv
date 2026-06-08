"""TV / monitor spec parser."""
from __future__ import annotations
import re
from typing import Any
from .base import BaseCategoryParser


class TVParser(BaseCategoryParser):
    CATEGORY = "tv"
    DETECT_KEYWORDS = [
        "smart tv", " tv ", "android tv", "google tv", "led tv",
        "qled", "oled tv", "mini led", "monitor", "smartv",
    ]

    SIZE_RE = re.compile(r"\b(\d{2,3})\s*(?:inch|in|\"|''|\u201d)\b", re.IGNORECASE)
    RESOLUTION_RE = re.compile(r"\b(4k|8k|uhd|fhd|hd|qhd|2k)\b", re.IGNORECASE)
    PANEL_RE = re.compile(r"\b(qled|oled|mini\s*led|led|lcd|ips|va)\b", re.IGNORECASE)
    HZ_RE = re.compile(r"\b(\d{2,3})\s*hz\b", re.IGNORECASE)
    SMART_RE = re.compile(r"\b(android\s*tv|google\s*tv|smart\s*tv|webos|tizen)\b", re.IGNORECASE)

    def extract_specs(self, name: str) -> dict[str, Any]:
        specs: dict[str, Any] = {}

        m = self.SIZE_RE.search(name)
        if m:
            specs["size_inch"] = int(m.group(1))

        m = self.RESOLUTION_RE.search(name)
        if m:
            specs["resolution"] = m.group(1).upper()

        m = self.PANEL_RE.search(name)
        if m:
            specs["panel_type"] = re.sub(r"\s+", "", m.group(1)).upper()

        m = self.HZ_RE.search(name)
        if m:
            specs["refresh_rate_hz"] = int(m.group(1))

        m = self.SMART_RE.search(name)
        if m:
            specs["smart_platform"] = re.sub(r"\s+", " ", m.group(1)).title()

        return specs
