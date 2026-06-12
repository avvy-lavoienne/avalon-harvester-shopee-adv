"""Known laptop brands whitelist. Hanya brand ini yang dianggap valid untuk kategori laptop."""

LAPTOP_BRANDS = {
    # 1. Brand Global Utama
    "ASUS", "LENOVO", "HP", "HEWLETT-PACKARD", "ACER", "DELL", "APPLE", "MSI", "MICROSOFT",

    # 2. Sub-brand Gaming & Enthusiast
    "ROG", "REPUBLIC OF GAMERS", "TUF", "LEGION", "LOQ", "PREDATOR",
    "ALIENWARE", "OMEN", "VICTUS", "RAZER",

    # 3. Brand Lokal Indonesia
    "ADVAN", "AXIOO", "ZYREX", "POLYTRON", "SPC", "EVERCOSS", "MITO",

    # 4. Brand Ekosistem Gadget
    "XIAOMI", "REDMIBOOK", "MI NOTEBOOK", "HUAWEI", "MATEBOOK",
    "INFINIX", "INBOOK", "TECNO", "MEGABOOK", "SAMSUNG", "GALAXY BOOK",
    "REALME", "REALME BOOK", "HONOR", "MAGICBOOK", "SURFACE", "GOOGLE", "PIXELBOOK",

    # 5. Brand Jepang & Korea
    "FUJITSU", "LIFEBOOK", "DYNABOOK", "TOSHIBA", "PANASONIC", "TOUGHBOOK",
    "VAIO", "LG", "GRAM",

    # 6. Brand Impor Ekonomis / Budget
    "CHUWI", "TECLAST", "BMAX", "JUMPER", "KUU", "DERE", "ALLDOCUBE",
    "MAIBENBEN", "NINKEAR", "DAYSKY", "TOPOSH", "GUMPER",

    # 7. Brand Workstation & Industri
    "GETAC", "DURABOOK", "GIGABYTE", "AORUS", "CLEVO", "TONGFANG",

    # 8. Brand Internasional Lainnya
    "SCHENKER", "XMG", "ELUKTRONICS", "ORIGIN PC", "CORSAIR", "MEDION",
    "SYSTEM76", "FRAMEWORK", "SLIMBOOK", "TUXEDO", "GATEWAY", "EUROCOM",
    "SAGER", "DIGITAL STORM", "CYBERPOWERPC", "IBUYPOWER", "AVADIRECT",
    "FALCON NORTHWEST", "VELOCITY MICRO", "MAINGEAR", "VIZIO",
    "THOMSON", "PACKARD BELL", "HASEE", "MECHREVO", "THUNDEROBOT",
    "MACHENIKE", "HAIER", "TCL", "POSITIVO", "AVELL", "INSPUR",
    "FOUNDER", "HST", "PCSHIPS", "ECS", "ELITEGROUP", "AOPEN",
    "ZOTAC", "WACOM", "GPD", "ONE-NETBOOK", "AYANEO", "EMATIC", "RCA",
    "LAVA", "HCL",

    # Seri / Nama produk yang sering muncul sebagai brand
    "THINKPAD", "MACBOOK", "VIVOBOOK", "SURFACE PRO", "SURFACE LAPTOP",
    "IDEAPAD", "THINKBOOK", "YOGA", "LEGION PRO", "SWIFT", "NITRO",
    "HELIOS", "STRIX", "ZEPHYRUS", "PROART", "EXPERTBOOK", "ZENBOOK",
    "XPS", "LATITUDE", "PRECISION", "INSPIRON", "ELITEBOOK", "PROBOOK",
    "ZBOOK", "SPECTRE", "ENVY", "PAVILION", "OMEN", "VICTUS",
    "GALAXY BOOK", "GRAM", "SURFACE", "MATEBOOK", "MAGICBOOK",
    "PREDATOR HELIOS", "TUF DASH", "ROG ZEPHYRUS", "ROG STRIX",
    "IDEAPAD GAMING", "LEGION PRO", "LOQ",
}

# Pipeline menggunakan brand_taxonomy dari schema_cache + seed data ini.
# Lihat pipeline.py:_ensure_taxonomy_loaded() untuk mekanisme runtime.