"""E2E test: generate schema untuk keyword + apply ke sample produk dari CSV user."""
import asyncio
import csv
import json
import os
import sys

os.environ.setdefault("DEEPSEEK_API_KEY", "sk-e33da053521b4811a9633b3127ebfc8e")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "fake_for_test")

sys.path.insert(0, "/app")

from worker.schema_generator import generate_schema
from worker.schema_engine import apply_schema


async def main():
    # Load sample dari CSV user
    samples = []
    with open("/tmp/shopee_v2.csv") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        # Ambil 15 nama produk untuk schema generation
        for r in rows[:15]:
            n = r.get("name_raw") or r.get("product_name")
            if n:
                samples.append(n)

    keyword = "laptop gaming"
    print(f"=== Generate schema untuk: {keyword} ===")
    print(f"Sample names ({len(samples)}):")
    for s in samples[:5]:
        print(f"  - {s[:90]}")
    print("  ...")

    result = await generate_schema(keyword, samples)
    schema = result["schema"]
    usage = result.get("usage", {})

    print(f"\nGenerated schema ({usage.get('total_tokens')} tokens):")
    print(f"  category       : {schema.get('category')}")
    print(f"  brands         : {list(schema.get('brands', {}).keys())[:10]}")
    print(f"  model_families : {schema.get('model_families', [])[:10]}")
    print(f"  spec fields    : {list(schema.get('spec_patterns', {}).keys())}")

    # Apply schema ke 5 produk berbeda dari CSV
    print("\n=== Apply schema ke produk lain (NO LLM call) ===\n")
    test_indices = [20, 35, 50, 65, 80, 95]
    for idx in test_indices:
        if idx >= len(rows):
            continue
        row = rows[idx]
        name = row.get("product_name") or row.get("name_raw")
        if not name:
            continue
        brand, specs = apply_schema(name, schema)
        print(f"NAME : {name[:90]}")
        print(f"  BRAND: {brand}")
        print(f"  SPECS: {json.dumps(specs, ensure_ascii=False)}")
        print()

    # Save schema ke file untuk inspect
    with open("/tmp/schema_laptop_gaming.json", "w") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)
    print("Schema saved to /tmp/schema_laptop_gaming.json")


asyncio.run(main())
