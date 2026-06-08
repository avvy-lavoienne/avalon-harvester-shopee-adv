"""Quick test untuk verify DeepSeek API works dengan API key user."""
import asyncio
import os
import sys

os.environ.setdefault("DEEPSEEK_API_KEY", "sk-e33da053521b4811a9633b3127ebfc8e")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "fake_for_test")

sys.path.insert(0, "/app")

from worker.deepseek_client import classify_with_llm


async def main():
    # 2 case yang sulit di-parse rule
    cases = [
        "Laptop Mini PC Asus ROG Ally Z1 / Z1 extreme 512GB UMPC Portable PC Gaming Windows 11",
        "Tas Ransel Eiger 25L Tactical Outdoor Hitam Original",
    ]
    for name in cases:
        print(f"\nNAME: {name}")
        try:
            result = await classify_with_llm(name)
            print(f"  CATEGORY: {result['category']}")
            print(f"  SPECS   : {result['specs']}")
            if result.get("usage"):
                u = result["usage"]
                print(f"  USAGE   : prompt={u.get('prompt_tokens')}, completion={u.get('completion_tokens')}, total={u.get('total_tokens')}")
        except Exception as e:
            print(f"  ERROR: {e}")


asyncio.run(main())
