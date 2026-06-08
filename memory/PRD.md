# Avalon Harvester — Project Memory

## 📋 Original Problem Statement
User punya Chrome Extension untuk scrape produk Shopee → kirim ke Supabase. Ada 2 issue utama yang mau diperbaiki:
1. **Cleaning nama produk** kurang bersih (masih ada emoji, tag promo, dll)
2. **Logic ekstraksi price & original_price** salah karena Shopee return JSON dengan format harga yang dianggap "inconsistent"

User juga tanya: apakah Chrome Extension efektif atau ada opsi lebih baik?

## 🎯 Tech Stack
- **Type**: Chrome Extension Manifest V3
- **Background**: service_worker (`background.js`)
- **Content Script**: `content.js` + injected `inject.js`
- **Storage**: Supabase REST (PostgREST) langsung dari background
- **Target**: shopee.co.id

## 🏗 Architecture
1. `inject.js` di-inject ke page, intercept `fetch` & `XHR` Shopee API:
   - `/api/v4/search/search_items`
   - `/api/v4/recommend/recommend`
   - `/api/v4/shop/get_shop_items`
2. Saat ada response, extract product data → dispatch `CustomEvent("Avalon_Harvest_Data")`
3. `content.js` dengar event → relay ke `background.js` via `chrome.runtime.sendMessage`
4. `background.js` map ke schema Supabase → batch POST dengan `on_conflict=item_id`
5. `background.js` juga manage keyword queue dari table `harvesting_keywords` di Supabase

## ✅ Implemented (Jan 2026)
### v2 — Enhanced Extraction & Cleaning
- **Price parser deterministik**: formula `Math.round(num / 100000)` (Shopee micro-unit standard). Hapus heuristic threshold yang error-prone.
- **Price extraction fallback chain**: `price → price_min` untuk varian. `price_before_discount → price_min_before_discount → price_max_before_discount` untuk original_price.
- **Discount % otomatis** dihitung dari (original - price) / original × 100.
- **Sanity check**: `original_price <= price` → set `null` (no discount).
- **Name cleaning 8-step**: emoji, decorative chars, bracketed promo tags `[COD]` `【READY】`, parens-with-spam (keep specs `(16GB)` `(i7)`), leading spam (`PROMO`, `DISKON`, `MURAH`, dll), trailing spam (`GARANSI RESMI`, `READY STOCK`, `BNIB`), discount-percentage residual `50%`, leading/trailing dash/pipe/slash, ALL-CAPS → Title Case (keep abbrev).
- **Field baru**: `name_raw` (original sebelum cleaning) untuk audit.
- **Brand list diperluas**: 18 → 100+ brand (laptop, smartphone, audio, kamera, home appliance, fashion, PC accessories, beauty). Sorted DESC by length supaya "Western Digital" match sebelum "WD". Fallback: first ALL CAPS or Title Case word.
- **Hapus filter "laptop/notebook"** hardcoded — sekarang terima semua produk apapun keywordnya.
- **Supabase migration**: tambah kolom `name_raw`, `price_min`, `price_max` + index brand/search_query/scraped_at + UNIQUE constraint pada `item_id`.

## 📁 Files
- `/app/inject.js` — extractor & cleaner (REWRITTEN)
- `/app/background.js` — Supabase relay (mapPayload updated)
- `/app/content.js` — event relay (unchanged)
- `/app/popup.js`, `/app/popup.html` — popup UI (unchanged)
- `/app/manifest.json` — MV3 manifest (unchanged)
- `/app/rules.json` — declarativeNetRequest rules (unchanged)
- `/app/supabase_migration.sql` — SQL untuk Supabase
- `/app/CHANGES.md` — changelog detail v2

## 🔑 Credentials (existing in code)
- Supabase URL: `https://fzomsxxbqdhgeafhygkp.supabase.co`
- Anon Key: stored in `background.js` (line 8)
- Worker ID: auto-generated per Chrome profile

## 📝 Backlog / Next Action Items
- [ ] **P1**: Jalankan `supabase_migration.sql` di Supabase SQL Editor (WAJIB sebelum reload extension)
- [ ] **P1**: Reload extension di `chrome://extensions/`, test harvest 1 keyword, verify di Supabase:
  - Kolom `name_raw` ≠ `product_name` (cleaning bekerja)
  - `price_min`/`price_max` terisi untuk produk varian
  - `original_price` = NULL untuk produk tanpa diskon
  - `discount_percentage` reasonable (tidak random 3-digit)
- [ ] **P2**: Pertimbangkan move Supabase anon key ke env config (kalau extension mau di-share publik)
- [ ] **P2**: Tambah retry logic exponential backoff di `sendBatch` (saat ini hanya log error)
- [ ] **P3**: Tambah dashboard analitik sederhana di Supabase view (top brand, avg discount per kategori)
- [ ] **P3**: Telegram/Discord webhook notification saat harvest selesai

## 💡 Enhancement Suggestion
**Price-drop alert**: simpan `price_history` table → bisa kirim notifikasi (Telegram/email) saat harga turun >X% dari rata-rata 30 hari. Ini bikin tool Anda jadi product-research weapon, bukan sekadar scraper.
