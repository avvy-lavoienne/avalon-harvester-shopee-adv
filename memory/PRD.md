# Avalon Harvester — Project Memory

## 📋 Original Problem Statement
User punya Chrome Extension untuk scrape produk Shopee → kirim ke Supabase. Issue awal:
1. Cleaning nama produk kurang bersih
2. Logic ekstraksi price salah (heuristic threshold)
3. Scalability multi-kategori
4. **Tokens DeepSeek wasted** karena per-product call → user usul: generate schema sekali per keyword, Python pakai schema itu (regex + rapidfuzz)

## 🎯 Final Architecture (v4)

```
Chrome Extension (inject.js + background.js)
    ↓ intercept Shopee API, basic clean (price, name, brand, model)
Supabase shopee_products (cleaning_status='pending')
    ↓
Python Worker (asyncio):
  Per produk:
    1. Lookup keyword_schemas[search_query]
       HIT → apply (regex + rapidfuzz) → 0 token
       MISS → DeepSeek generate schema (1×) → cache → apply
    2. UPDATE row dengan category, specs JSONB, brand
Supabase shopee_products (enriched)
```

**Cost**: ~$0.001/keyword (one-time) × 50 keyword = $0.05 total untuk 10rb produk
(vs $0.30 jika per-product LLM call → **40× lebih murah**)

## ✅ Implemented (Jan 2026)

### v2 — Chrome Extension Enhanced
- Price parser deterministik (Shopee micro-unit: `num / 100000`)
- Price fallback chain (price_min, price_max, price_before_discount variants)
- Auto discount %, sanity check
- Name cleaning 9-step (emoji, decorative, tag promo, parens-with-spec-preserve, spam prefix/trailing, smart Title Case preserve model code, leading/trailing dash)
- Brand list 100+ + blacklist generic words
- Model extraction stops at spec keywords
- File: `inject.js`, `background.js`, `supabase_migration.sql`

### v3 — Python Worker (Per-product LLM, deprecated)
- 6 kategori built-in (laptop, smartphone, audio, tv, fashion, generic)
- DeepSeek fallback per produk → REPLACED by v4

### v4 — Schema-Per-Keyword (CURRENT, OPTIMIZED)
- **`schema_generator.py`**: DeepSeek 1× per keyword, generate regex+brand+fuzzy JSON
- **`schema_engine.py`**: apply schema dengan multi-match + sanity validation + TB→GB conversion + rapidfuzz brand
- **`schema_cache.py`**: Supabase `keyword_schemas` table ops (upsert, fetch, counter)
- **`pipeline.py`**: pakai cached schema (memoized in-process + Supabase persistent)
- **Per-keyword lock**: race-safe (5 concurrent products → 1 LLM call)
- **Built-in fallback** ke `categories/*.py` rule-based kalau schema gagal
- Test: schema gen 2569 tokens (~$0.001), apply ke produk lain perfect (CPU/GPU/RAM/Storage TB-converted/OS/model_family)

## 📁 Files

### Chrome Extension (/app)
- `inject.js`, `background.js`, `content.js`, `popup.js`, `popup.html`, `manifest.json`, `rules.json`, `content.css`
- `supabase_migration.sql` (v2)
- `supabase_migration_v3.sql` (v3: category, specs JSONB, cleaning_status)
- `supabase_migration_v4.sql` (v4: keyword_schemas table)
- `CHANGES.md`

### Python Worker (/app/worker)
- `requirements.txt`, `.env.example`, `README.md`
- `config.py`, `main.py` — entry
- `pipeline.py` — schema-first
- `schema_generator.py` — DeepSeek call
- `schema_engine.py` — regex+rapidfuzz apply
- `schema_cache.py` — Supabase ops
- `supabase_client.py` — generic ops
- `category_detector.py`, `categories/` — fallback built-in parsers
- `deepseek_client.py` — legacy per-product (kept for emergency fallback)
- `test_offline.py`, `test_llm.py`, `test_e2e_schema.py`

## 🔑 Credentials
- Supabase URL: `https://fzomsxxbqdhgeafhygkp.supabase.co` (in background.js)
- DeepSeek API Key: `sk-e33da053521b4811a9633b3127ebfc8e` (in .env.example, provided by user)
- **Supabase Service Role Key: PENDING** — user perlu isi di `/app/worker/.env`

## 📝 Next Action Items
- [ ] **P0 (USER)**: Run SQL migrations urut: `supabase_migration.sql`, `_v3.sql`, `_v4.sql` di Supabase
- [ ] **P0 (USER)**: Service Role Key → `/app/worker/.env`
- [ ] **P0 (USER)**: `cd /app && pip install -r worker/requirements.txt`
- [ ] **P0 (USER)**: Reload extension + harvest beberapa keyword berbeda
- [ ] **P0 (USER)**: `python -m worker.main` → cek log + verify `keyword_schemas` table terisi + `specs` di shopee_products terisi
- [ ] **P2**: Dashboard (FastAPI + React) untuk schema quality monitoring (miss_rate per keyword)
- [ ] **P2**: Auto-regenerate schema kalau miss_rate > 30% (currently manual via DELETE)

## 💡 Enhancement Ideas
- Multi-tenant dashboard subscription (price intelligence, brand share)
- Price-drop alert via Telegram (history table + trigger)
- Auto-suggest harvesting keywords berdasar trending Shopee category
