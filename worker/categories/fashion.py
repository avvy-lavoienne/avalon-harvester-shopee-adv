"""Fashion (sepatu, baju, tas) spec parser."""
from __future__ import annotations
import re
from typing import Any
from .base import BaseCategoryParser


class FashionParser(BaseCategoryParser):
    CATEGORY = "fashion"
    DETECT_KEYWORDS = [
        "sepatu", "shoes", "sneaker", "sandal", "boots", "loafer",
        "baju", "kaos", "shirt", "celana", "pants", "jeans",
        "jaket", "jacket", "hoodie", "sweater", "dress", "rok",
        "tas", "bag", "ransel", "backpack", "topi", "hat", "cap",
    ]

    TYPE_RE = re.compile(
        r"\b(sepatu|shoes|sneaker|sandal|boots|loafer|baju|kaos|shirt|"
        r"celana|pants|jeans|jaket|jacket|hoodie|sweater|dress|rok|"
        r"tas|bag|ransel|backpack|topi|hat|cap)\b",
        re.IGNORECASE,
    )
    SIZE_RE = re.compile(r"\b(?:size|ukuran|sz)\s*[:\-]?\s*(xs|s|m|l|xl|xxl|xxxl|\d{2,3})\b", re.IGNORECASE)
    SIZE_RANGE_RE = re.compile(r"\b(\d{2,3})\s*-\s*(\d{2,3})\b")
    COLOR_RE = re.compile(
        r"\b(hitam|putih|merah|biru|hijau|kuning|abu|abu-abu|navy|cream|"
        r"coklat|cokelat|pink|ungu|orange|maroon|tosca|gold|silver|"
        r"black|white|red|blue|green|yellow|grey|gray|brown|purple)\b",
        re.IGNORECASE,
    )
    GENDER_RE = re.compile(r"\b(pria|wanita|cowok|cewek|men|women|male|female|unisex)\b", re.IGNORECASE)

    def extract_specs(self, name: str) -> dict[str, Any]:
        specs: dict[str, Any] = {}

        m = self.TYPE_RE.search(name)
        if m:
            specs["item_type"] = m.group(1).title()

        m = self.SIZE_RE.search(name)
        if m:
            specs["size"] = m.group(1).upper()
        else:
            m = self.SIZE_RANGE_RE.search(name)
            if m:
                specs["size_range"] = f"{m.group(1)}-{m.group(2)}"

        colors = list({c.title() for c in self.COLOR_RE.findall(name)})
        if colors:
            specs["colors"] = colors

        m = self.GENDER_RE.search(name)
        if m:
            specs["gender"] = m.group(1).title()

        return specs
