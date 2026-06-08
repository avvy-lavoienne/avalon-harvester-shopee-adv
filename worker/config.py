"""Konfigurasi worker dari environment variable."""
import os
from dotenv import load_dotenv

load_dotenv()

DEEPSEEK_API_KEY = os.environ["DEEPSEEK_API_KEY"]
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_TABLE = os.environ.get("SUPABASE_TABLE", "shopee_products")

BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "30"))
MAX_CONCURRENT_LLM = int(os.environ.get("MAX_CONCURRENT_LLM", "4"))
SLEEP_BETWEEN_BATCHES = float(os.environ.get("SLEEP_BETWEEN_BATCHES", "2.0"))
LLM_FALLBACK_ENABLED = os.environ.get("LLM_FALLBACK_ENABLED", "true").lower() == "true"
