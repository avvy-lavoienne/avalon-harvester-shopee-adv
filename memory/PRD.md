# Avalon Harvester — Project Memory

## 📋 Original Problem Statement
User punya Chrome Extension untuk scrape produk Shopee → kirim ke Supabase. Issue awal:
1. **Cleaning nama produk** kurang bersih
2. **Logic ekstraksi price & original_price** salah (heuristic threshold)
3. **Scalability untuk produk non-laptop** (saat ini terlalu laptop-centric)

Pertanyaan strategis user: butuh Python script atau DeepSeek LLM processing?
Jawaban: **Hybrid (rule-based Python + DeepSeek fallback)** dengan arsitektur **category-agnostic**.

## 🎯 Tech Stack
- **Chrome Extension** (Manifest V3): `inject.js` intercept Shopee API → extract & basic clean → Supabase REST
- **Python Worker** (asyncio): kategorisasi multi-kategori, ekstrak spec, DeepSeek fallback
- **Supabase**: `shopee_products` table dengan kolom enriched (category, specs JSONB)
- **DeepSeek LLM** (deepseek-chat, OpenAI-compatible): fallback ~5-10% kasus

## 🏗 Architecture

```
Chrome Extension (background.js + inject.js)
    ↓ HTTP intercept (fetch + XHR) Shopee API
    ↓ basic clean (price parser, name cleaner, brand detect, model extract)
Supabase shopee_products (cleaning_status='pending')
    ↓
Python Worker (asyncio)
    1. detect_category() — keyword match per kategori
    2. parser.extract_specs() — regex per kategori
    3. Fallback ke DeepSeek kalau category=generic ATAU specs<2
    ↓ UPDATE row dengan category, specs (JSONB), cleaning_status='done'
Supabase (enriched, analytics-ready)
```

## ✅ Implemented (Jan 2026)

### v2 — Enhanced inject.js Extraction & Cleaning
- **Price parser deterministik**: `Math.round(num / 100000)` (Shopee micro-unit)
- **Price fallback chain**: `price → price_min`, `price_before_discount → price_min_before_discount → price_max_before_discount`
- **Auto discount %** dari selisih harga
- **price_min, price_max** untuk produk varian
- **Name cleaning multi-step**: emoji, dekoratif, tag promo, parens-with-promo (preserve specs), spam prefix/trailing, discount residual, ALL CAPS smart Title Case (preserve model code FA506NCG/RTX3050/7445HS)
- **Brand list 100+** + canonical casing + blacklist generic words ("LAPTOP"/"GAMING")
- **Model extraction**: stop at spec keywords (Intel/AMD/Ryzen/Ram/SSD/GPU)
- **Hapus filter laptop/notebook** hardcoded

### v3 — Python Worker Multi-Category + DeepSeek Hybrid
- **Category-agnostic architecture**: `/app/worker/categories/` registry
- **Parser per kategori** (rule-based regex):
  - `laptop.py`: CPU/GPU/RAM/storage/screen/refresh/OS
  - `smartphone.py`: RAM/storage/chipset/camera/battery/network
  - `audio.py`: type/connection/BT version/ANC/battery/driver/IPX
  - `tv.py`: size/resolution/panel/Hz/platform
  - `fashion.py`: type/size/colors/gender
  - `generic.py`: fallback numeric measurements
- **Category detector**: keyword scoring + boost dari search_query
- **DeepSeek client**: OpenAI-compatible (AsyncOpenAI), JSON mode, retry with exponential backoff
- **Pipeline**: rule-first, LLM fallback hanya kalau perlu (~5-10% kasus)
- **Async batching**: BATCH_SIZE=30, MAX_CONCURRENT_LLM=4, semaphore
- **Cost**: ~300 tokens/produk × $0.42/1M ≈ $0.0001/produk

### Test Results (offline)
Category accuracy: **11/11** (laptop/smartphone/audio/tv/fashion/generic)
DeepSeek LLM live test: ✅ ROG Ally (brand+model+storage+os), Tas Eiger (brand+size+color)

## 📁 Files

### Chrome Extension (root /app)
- `inject.js` — extractor & cleaner (REWRITTEN v3)
- `background.js` — Supabase relay (mapPayload v3 with new fields)
- `content.js`, `popup.js`, `popup.html`, `manifest.json`, `rules.json`, `content.css`
- `supabase_migration.sql` — v2: name_raw, price_min, price_max
- `supabase_migration_v3.sql` — v3: category, specs JSONB, cleaning_status, trigger auto-set pending
- `CHANGES.md` — v2 changelog

### Python Worker (/app/worker)
- `requirements.txt`, `.env.example`, `README.md`
- `config.py` — env loader
- `main.py` — entry point (loop + signal handler)
- `pipeline.py` — process_product (detect → parse → LLM fallback)
- `category_detector.py` — keyword scoring
- `deepseek_client.py` — OpenAI-compatible client w/ retry
- `supabase_client.py` — async wrapper around sync supabase-py
- `categories/` — base + 6 kategori
- `test_offline.py`, `test_llm.py` — verification scripts

## 🔑 Credentials
- Supabase URL: `https://fzomsxxbqdhgeafhygkp.supabase.co` (hardcoded di background.js)
- Anon Key: in background.js (untuk extension write)
- **Service Role Key**: BELUM diberikan user — perlu untuk Python worker. User isi di `/app/worker/.env`
- DeepSeek API Key: `sk-e33da053521b4811a9633b3127ebfc8e` (provided by user, in .env.example)

## 📝 Next Action Items
- [ ] **P0 (USER)**: Run `/app/supabase_migration.sql` lalu `/app/supabase_migration_v3.sql` di Supabase
- [ ] **P0 (USER)**: Get Supabase Service Role Key → masukkan ke `/app/worker/.env`
- [ ] **P0 (USER)**: Reload Chrome extension → harvest beberapa produk variasi (HP/audio/TV/fashion)
- [ ] **P0 (USER)**: Run `cd /app && python -m worker.main` → cek log + Supabase `category`+`specs` terisi
- [ ] **P1**: Tambah kategori sesuai kebutuhan klien (smartwatch, kamera, kosmetik, makanan, dll)
- [ ] **P2**: Dashboard analytics (FastAPI + React) untuk visualisasi data
- [ ] **P2**: Price history table + trigger → alert price drop via Telegram/Discord
- [ ] **P3**: Move Supabase keys & DeepSeek key ke vault/secret manager untuk production

## 💡 Enhancement Ideas
- **Price-drop alert**: history table → notif >X% turun dari avg 30 hari
- **Spec-based price intelligence**: "Rp/GB RAM" benchmark per kategori
- **Multi-tenant**: kasih klien akses Supabase view filtered by project_id mereka → jual dashboard subscription
- **Auto-categorize Shopee URL**: berdasar URL `/cat-` segment, prefill category sebelum scrape
