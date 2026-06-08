"""Test offline: validate rule-based parser + category detector.
Skip DeepSeek call (offline test).
"""
import sys
sys.path.insert(0, "/app")

from worker.category_detector import detect_category
from worker.categories import get_parser

CASES = [
    # (name, expected_category, search_query)
    ("ASUS Gaming Rog Strix G16 G614PH-R9N55C6G-HM Grey AMD Ryzen 9-8940HX 16GB 512GB RTX 5050 8GB GDDR7 WIN 11 Home", "laptop", "laptop gaming"),
    ("Lenovo LOQ Essential 15ARP10E GeForce RTX 3050 6GB Ryzen 7 7735HS 16GB 512GB Windows 11", "laptop", "laptop gaming"),
    ("Infinix Xbook B14 Ryzen 5 7535HS 16GB 512GB W11 14.0WUXGA IPS", "laptop", "laptop gaming"),
    # Smartphone
    ("Samsung Galaxy A54 5G 8GB/256GB BNIB SEIN Snapdragon 778G", "smartphone", "hp samsung"),
    ("Xiaomi Redmi Note 13 Pro 5G 8/256GB Dimensity 7200-Ultra Camera 200MP 5100mAh", "smartphone", "hp xiaomi"),
    ("iPhone 15 Pro Max 256GB Apple A17 Pro 4422mAh", "smartphone", None),
    # Audio
    ("JBL Tune 510BT Headphone Bluetooth 5.0 ANC 40 jam battery", "audio", "headphone"),
    ("Sony WH-1000XM5 Wireless Over-Ear Headphone Noise Cancelling Bluetooth 5.2", "audio", None),
    # TV
    ("Samsung Smart TV 55 inch 4K UHD QLED Tizen 120Hz", "tv", "smart tv"),
    # Fashion
    ("Sepatu Nike Air Max 270 React Hitam Putih Size 42 Pria", "fashion", "sepatu"),
    # Generic / hard
    ("Kabel Data USB Type C 3A Fast Charging", "generic", None),
]

print(f"{'='*100}")
print(f"{'NAME':<55} | {'EXPECTED':<10} | {'GOT':<10} | SPECS")
print(f"{'='*100}")

correct = 0
for name, expected, query in CASES:
    cat, score = detect_category(name, query)
    specs = get_parser(cat).extract_specs(name)
    ok = "✓" if cat == expected else "✗"
    correct += 1 if cat == expected else 0
    name_short = name[:53] + ".." if len(name) > 55 else name
    print(f"{ok} {name_short:<53} | {expected:<10} | {cat:<10} | {specs}")

print(f"\n=== Category accuracy: {correct}/{len(CASES)} ===")
