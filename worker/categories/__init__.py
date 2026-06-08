"""Category-specific spec parser registry.

Tambah kategori baru:
1. Buat file `categories/xxx.py` extends BaseCategoryParser
2. Import dan daftarkan ke REGISTRY di bawah
"""
from .base import BaseCategoryParser
from .laptop import LaptopParser
from .smartphone import SmartphoneParser
from .audio import AudioParser
from .tv import TVParser
from .fashion import FashionParser
from .generic import GenericParser

REGISTRY: dict[str, BaseCategoryParser] = {
    "laptop": LaptopParser(),
    "smartphone": SmartphoneParser(),
    "audio": AudioParser(),
    "tv": TVParser(),
    "fashion": FashionParser(),
    "generic": GenericParser(),
}


def get_parser(category: str) -> BaseCategoryParser:
    return REGISTRY.get(category, REGISTRY["generic"])
