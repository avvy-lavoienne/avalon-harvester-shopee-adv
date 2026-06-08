# Avalon Worker v4 — Schema-Per-Keyword (Smart Cost)

Python worker dengan **arsitektur baru**: DeepSeek generate schema 1× per keyword,
Python apply schema (regex + rapidfuzz) ke SEMUA produk dari keyword itu. **NO per-product LLM call.**

## 🏗 Architecture v4

```
Chrome Extension (inject.js)
    ↓ scrape + basic clean → Supabase shopee_products
Python Worker:
  Per produk:
    1. Lookup keyword_schemas[search_query]
       HIT  → apply schema (regex + rapidfuzz) → DONE (0 token)
       MISS → DeepSeek generate schema (1×) → cache → apply
    2. UPDATE row: category, specs (JSONB), cleaning_status='done'
```

**Cost compare**:
| Mode | 10rb produk, 50 keyword |
|---|---|
| Per-product LLM (v3) | ~$0.30 |
| **Schema-per-keyword (v4)** | **~$0.05** (40× lebih murah) |

## 📦 Setup

1. **Install dependencies**:
   ```bash
   cd /app/worker && pip install -r requirements.txt
   ```

2. **Jalankan SQL migration di Supabase** (urut):
   ```sql
   -- /app/supabase_migration.sql      (v2: name_raw, price_min, price_max)
   -- /app/supabase_migration_v3.sql   (v3: category, specs JSONB, cleaning_status, trigger)
   -- /app/supabase_migration_v4.sql   (v4: keyword_schemas table — INI YANG BARU)
   ```

3. **Konfigurasi `.env`**:
   ```bash
   cp .env.example .env
   # Edit SUPABASE_SERVICE_ROLE_KEY (ambil dari Supabase Dashboard → Settings → API)
   ```

4. **Run worker**:
   ```bash
   cd /app && python -m worker.main
   ```

## 🗂 How Schema Looks (cached di Supabase `keyword_schemas`)

```json
{
  "category": "laptop",
  "brands": {
    "Lenovo": ["lenovo", "lonovo"],
    "ASUS": ["asus", "azus"],
    "Acer": ["acer"]
  },
  "model_families": ["LOQ", "TUF", "ROG", "Vivobook", "Aspire", ...],
  "spec_patterns": {
    "cpu":           "\\b((?:intel\\s+)?core\\s+i[3579][\\-\\s]?\\d{3,5}[a-z]{0,3}|ryzen\\s+\\d\\s+\\d{4}[a-z]{0,3})\\b",
    "gpu":           "\\b(rtx\\s*\\d{4}|gtx\\s*\\d{4}|mx\\d{3})\\b",
    "ram_gb":        "\\b(\\d{1,3})\\s*gb\\s+(?:ram|ddr\\d?)\\b",
    "storage_gb":    "\\b(\\d{2,4})\\s*gb\\s*(?:ssd|nvme|hdd)\\b|\\b(\\d{1,2})\\s*tb\\b",
    "screen_inch":   "\\b(\\d{2}(?:\\.\\d)?)\\s*inch\\b",
    "refresh_rate_hz": "\\b(\\d{2,3})\\s*hz\\b",
    "os":            "\\b(win(?:dows)?\\s*\\d+|chrome\\s*os)\\b"
  },
  "spec_value_types": {
    "cpu": "str", "gpu": "str", "ram_gb": "int",
    "storage_gb": "int", "screen_inch": "float",
    "refresh_rate_hz": "int", "os": "str"
  }
}
```

## 🔄 Schema Workflow per Keyword

```
Keyword pertama kali muncul di harvest
    ↓
Worker fetch 12 sample nama produk
    ↓
Call DeepSeek (1×, ~2500 tokens, ~$0.001) → generate schema JSON
    ↓
Cache di Supabase keyword_schemas (upsert by keyword)
    ↓
Apply ke SEMUA produk dari keyword ini (regex + rapidfuzz, 0 token)
    ↓
Subsequent harvest dari keyword sama → schema cache HIT, NO LLM call
```

## ⚙ Engine Features

- **Sanity validation** per field: tolak `ram_gb < 2`, `storage_gb < 16`, `screen_inch > 100`, dll
- **Multi-match scan**: untuk numeric field, ambil yang TERBESAR yang lolos sanity (RAM > VRAM)
- **TB → GB conversion**: kalau captured "1" tapi context ada "1TB", otomatis 1024
- **Rapidfuzz brand match**: handle typo seller (Aciapuw → ASUS, score >= 85%)
- **Per-keyword lock**: kalau 5 task butuh schema sama, hanya 1 yang call LLM

## 🧪 Test

```bash
# Offline: schema engine validation (no API)
python -m worker.test_offline

# Schema generation live (1 DeepSeek call)
python worker/test_e2e_schema.py
```

## 📈 Monitoring Schema Quality

```sql
-- Schema dengan miss_count tinggi → perlu re-generate
SELECT keyword, category, product_count, miss_count,
       ROUND(100.0 * miss_count / NULLIF(product_count, 0), 1) AS miss_rate
FROM keyword_schemas
ORDER BY miss_rate DESC NULLS LAST;

-- Token cost per keyword
SELECT keyword, llm_tokens_used, generated_at FROM keyword_schemas;

-- Force regenerate schema untuk keyword tertentu
DELETE FROM keyword_schemas WHERE keyword = 'laptop gaming';
-- Worker akan auto-generate ulang next run
```

## 🚀 Add New Keyword Category

Cukup harvest produk dengan keyword baru → worker auto-generate schema.
Tidak perlu coding apa-apa lagi! Contoh:

- Keyword "smart tv 55 inch" → DeepSeek generate schema kategori `tv` dengan field size_inch, resolution, panel, smart_platform
- Keyword "sepatu nike" → schema `fashion` dengan item_type, size, colors, gender
- Keyword "skincare serum vitamin c" → schema `beauty` dengan volume_ml, ingredient, skin_type, dll

## 💡 Advanced

### Force regenerate schema (kalau hasil kurang bagus):
```sql
DELETE FROM keyword_schemas WHERE keyword = 'laptop gaming';
```

### Re-process produk yang gagal:
```sql
UPDATE shopee_products SET cleaning_status = 'pending'
WHERE category = 'generic' AND search_query = 'laptop gaming';
```
