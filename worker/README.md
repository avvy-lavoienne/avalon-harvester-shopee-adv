# Avalon Worker — Multi-Category Product Cleaner & Enricher

Python worker yang baca produk dari Supabase, kategorisasi & ekstrak spec (rule-based),
fallback ke DeepSeek LLM kalau gagal/tidak yakin.

## 🏗 Architecture

```
Chrome Extension (inject.js)
    ↓ scrape + basic clean
Supabase shopee_products
    ↓ cleaning_status = 'pending'
Python Worker
    ↓ 1. detect_category() — pakai keyword dictionary per kategori
    ↓ 2. parser.extract_specs() — regex per kategori (rule-based)
    ↓ 3. Kalau category=generic ATAU specs<2 → fallback DeepSeek (~5-10% kasus)
    ↓ 4. UPDATE row dengan category, specs (JSONB), cleaning_status=done
Supabase shopee_products (enriched)
```

## 📦 Setup

1. **Install dependencies**:
   ```bash
   cd /app/worker
   pip install -r requirements.txt
   ```

2. **Run SQL migration** di Supabase SQL Editor:
   ```bash
   # File: /app/supabase_migration_v3.sql
   ```
   Ini tambah kolom: `category`, `category_score`, `specs` (JSONB), `cleaning_status`,
   `cleaning_method`, `llm_used` + index untuk fast query.

3. **Konfigurasi `.env`**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Isi:
   - `DEEPSEEK_API_KEY` (sudah ada di .env.example)
   - `SUPABASE_SERVICE_ROLE_KEY` — **WAJIB**, dapatkan di Supabase Dashboard →
     Settings → API → `service_role` key (bukan anon key, supaya bypass RLS)

4. **Run worker**:
   ```bash
   cd /app
   python -m worker.main
   ```

## 🗂 Multi-Category Architecture

### Tambah kategori baru (contoh: "smartwatch")

1. Buat `worker/categories/smartwatch.py`:
   ```python
   from .base import BaseCategoryParser
   import re

   class SmartwatchParser(BaseCategoryParser):
       CATEGORY = "smartwatch"
       DETECT_KEYWORDS = ["smartwatch", "smart watch", "fitness tracker", "mi band"]
       
       SCREEN_RE = re.compile(r"\b(\d(?:[.,]\d)?)\s*inch\b", re.I)
       BATTERY_RE = re.compile(r"\b(\d{1,3})\s*hari\b", re.I)
       
       def extract_specs(self, name):
           specs = {}
           m = self.SCREEN_RE.search(name)
           if m: specs["screen_inch"] = self._to_float(m.group(1))
           m = self.BATTERY_RE.search(name)
           if m: specs["battery_days"] = int(m.group(1))
           return specs
   ```

2. Register di `worker/categories/__init__.py`:
   ```python
   from .smartwatch import SmartwatchParser
   REGISTRY["smartwatch"] = SmartwatchParser()
   ```

3. Update SYSTEM_PROMPT di `worker/deepseek_client.py` (tambah "smartwatch" ke list).

**Done!** Worker otomatis pakai kategori baru.

### Kategori yang sudah ada
| Kategori | Spec yang diekstrak |
|---|---|
| `laptop` | cpu, gpu, ram_gb, storage_gb, storage_type, screen_inch, refresh_rate_hz, display_type, os |
| `smartphone` | ram_gb, storage_gb, chipset, camera_mp_max, camera_setup_mp, battery_mah, network, refresh_rate_hz |
| `audio` | device_type, connection, bluetooth_version, anc, battery_hours, driver_mm, water_resistance |
| `tv` | size_inch, resolution, panel_type, refresh_rate_hz, smart_platform |
| `fashion` | item_type, size, size_range, colors, gender |
| `generic` | raw_measurements (fallback) |

## 🧪 Testing

```bash
# Offline test (no API call)
python -m worker.test_offline

# DeepSeek LLM test (1 API call per case)
python worker/test_llm.py
```

## 💰 Cost Estimate (DeepSeek)

- Average ~300 tokens/product (prompt + completion)
- DeepSeek pricing: ~$0.14/1M input + $0.28/1M output
- **~$0.0001 per product** → $1 untuk 10.000 produk
- Dengan fallback rule-first (~5-10% LLM usage), cost real <$0.10 untuk 10rb produk

## 🚀 Run as Service

### Cron (jalan tiap 5 menit)
```cron
*/5 * * * * cd /app && /usr/bin/python -m worker.main >> /var/log/avalon_worker.log 2>&1
```

### Systemd unit (recommended untuk production)
```ini
[Unit]
Description=Avalon Cleaning Worker
After=network.target

[Service]
WorkingDirectory=/app
ExecStart=/usr/bin/python -m worker.main
Restart=on-failure
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

### Supervisor
```ini
[program:avalon-worker]
directory=/app
command=/usr/bin/python -m worker.main
autostart=true
autorestart=true
stdout_logfile=/var/log/avalon_worker.log
```

## 🔍 Query Hasil

Setelah worker run, di Supabase:

```sql
-- Top brand di laptop gaming
SELECT brand, COUNT(*) cnt, AVG(price) avg_price
FROM shopee_products
WHERE category = 'laptop' AND search_query ILIKE '%gaming%'
GROUP BY brand ORDER BY cnt DESC;

-- Smartphone dengan RAM ≥ 12GB & 5G
SELECT product_name, price, specs
FROM shopee_products
WHERE category = 'smartphone'
  AND (specs->>'ram_gb')::int >= 12
  AND specs->>'network' = '5G';

-- Audit: produk yang pakai LLM fallback
SELECT product_name, category, specs, cleaning_method
FROM shopee_products
WHERE llm_used = true
LIMIT 50;
```
