"""Audio device (headphone, earphone, speaker, soundbar) spec parser."""
from __future__ import annotations
import re
from typing import Any
from .base import BaseCategoryParser


class AudioParser(BaseCategoryParser):
    CATEGORY = "audio"
    DETECT_KEYWORDS = [
        "headphone", "earphone", "earbuds", "tws", "headset", "speaker",
        "soundbar", "subwoofer", "airpods", "buds", "bluetooth audio",
        "in-ear", "over-ear", "on-ear", "noise cancelling", "anc",
    ]

    TYPE_RE = re.compile(
        r"\b(tws|true\s*wireless|earbuds|in[-\s]?ear|over[-\s]?ear|on[-\s]?ear|"
        r"headphone|headset|earphone|speaker|soundbar|subwoofer)\b",
        re.IGNORECASE,
    )
    WIRELESS_RE = re.compile(r"\b(bluetooth|wireless|wired|cable|tws|kabel)\b", re.IGNORECASE)
    BT_VERSION_RE = re.compile(r"\bbluetooth\s*(\d(?:\.\d)?)\b", re.IGNORECASE)
    ANC_RE = re.compile(r"\b(anc|active\s*noise\s*cancel(?:l)?ation|noise\s*cancel(?:l)?ing|ncc)\b", re.IGNORECASE)
    BATTERY_RE = re.compile(r"\b(\d{1,3})\s*(?:jam|hours|hrs?|h)\s+(?:playback|battery|main)?", re.IGNORECASE)
    DRIVER_RE = re.compile(r"\b(\d{1,2}(?:[.,]\d)?)\s*mm\s+driver\b", re.IGNORECASE)
    IPX_RE = re.compile(r"\b(ipx?\d{1,2})\b", re.IGNORECASE)

    def extract_specs(self, name: str) -> dict[str, Any]:
        specs: dict[str, Any] = {}

        m = self.TYPE_RE.search(name)
        if m:
            specs["device_type"] = m.group(1).upper().replace(" ", "-")

        m = self.WIRELESS_RE.search(name)
        if m:
            v = m.group(1).lower()
            specs["connection"] = "Wireless" if v in {"bluetooth", "wireless", "tws"} else "Wired"

        m = self.BT_VERSION_RE.search(name)
        if m:
            specs["bluetooth_version"] = m.group(1)

        if self.ANC_RE.search(name):
            specs["anc"] = True

        m = self.BATTERY_RE.search(name)
        if m:
            specs["battery_hours"] = int(m.group(1))

        m = self.DRIVER_RE.search(name)
        if m:
            specs["driver_mm"] = self._to_float(m.group(1))

        m = self.IPX_RE.search(name)
        if m:
            specs["water_resistance"] = m.group(1).upper()

        return specs
