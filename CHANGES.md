# Avalon Harvester — Perbaikan v2

## 📦 File yang Diubah
- `inject.js` — **rewrite total**: price parser deterministik, name cleaning baru, brand detection diperluas
- `background.js` — `mapPayload()` mendukung field baru
- `supabase_migration.sql` — **wajib dijalankan** sebelum reload extension

---

## 🔧 1. Price Parsing — Bukan Lagi Heuristic

**Sebelum** (salah, pakai tebak-tebakan threshold):
```js
if (num > 200000000) final = Math.round(num / 10000);
else if (num > 50000000) final = Math.round(num / 100);
// ...
```

**Sekarang** (deterministik, formula resmi Shopee):
```js
return Math.round(num / 100000);
```

Shopee API SELALU return price dalam `micro-unit` = `IDR × 100000`.
- `15000000000` → Rp 150.000 ✓
- `350000000` → Rp 3.500 ✓

---

## 🔧 2. Original Price & Diskon

Sekarang fallback chain yang benar:
```
price_before_discount → price_min_before_discount → price_max_before_discount
```

- Kalau `original_price <= price` → set `null` (tidak ada diskon)
- `discount_percentage` dihitung otomatis dari (original - price) / original × 100
- Kalau price field-nya `0` atau `-1` → return `null` (Shopee sentinel "no value")

---

## 🔧 3. Produk Varian (price_min ≠ price_max)

- `price` utama → `price_min` (terendah) kalau `obj.price` kosong
- `price_min` & `price_max` disimpan terpisah → bisa lihat range varian

---

## 🔧 4. Name Cleaning

**Sebelum**: `obj.name.trim()` doang.

**Sekarang** (8 langkah):
1. Hapus emoji (semua block unicode emoji)
2. Hapus karakter dekoratif: `★ ✦ ▪ ● ◆ ✨ ➤` dll
3. Hapus tag promo dalam kurung siku: `[COD]`, `【BISA COD】`, `〖PROMO〗`
4. Hapus kurung biasa berisi promo, **tapi keep spec** seperti `(16GB)`, `(i7)`, `(RTX 3060)`, `(15.6 inch)`
5. Hapus spam prefix berulang: `PROMO`, `DISKON`, `READY STOCK`, `COD`, `MURAH`, `FREE ONGKIR` dll
6. Normalize tanda baca berlebih (`!!!`, `~~~`, `||`, `--`)
7. Normalize whitespace
8. Kalau seluruh nama ALL CAPS → Title Case (tetap pertahankan abbreviation: SSD, RAM, GHz, dll)

Field baru: `name_raw` menyimpan nama original (untuk audit/debug).

---

## 🔧 5. Brand & Model Detection

- Brand list diperluas dari **18 → 100+ brand** (laptop, smartphone, audio, kamera, home appliance, fashion, PC accessories, beauty)
- Sorted by length DESC → "Western Digital" match sebelum "WD"
- Fallback: kata pertama ALL CAPS / Title Case (3+ chars)
- Model: stop di separator ` - `, ` | `, ` / `; max 6 kata; max 80 char

---

## 🔧 6. Filter "laptop/notebook" — DIHAPUS

Sebelumnya semua non-laptop di-skip. Sekarang **semua produk** apa pun keywordnya akan masuk.

---

## 🗄 7. Supabase Migration

Wajib jalanin SQL ini sekali di Supabase Editor:

```sql
ALTER TABLE public.shopee_products
  ADD COLUMN IF NOT EXISTS name_raw   TEXT,
  ADD COLUMN IF NOT EXISTS price_min  NUMERIC,
  ADD COLUMN IF NOT EXISTS price_max  NUMERIC;
```

Plus constraint UNIQUE pada `item_id` (kalau belum ada) — wajib untuk `on_conflict=item_id`.
Lihat `supabase_migration.sql` untuk versi lengkap dengan index opsional.

---

## ✅ Cara Test

1. Run `supabase_migration.sql` di Supabase
2. Reload extension di `chrome://extensions`
3. Buka DevTools Console di tab Shopee
4. Cari log `[Avalon Harvester] inject.js v2 loaded — enhanced cleaning`
5. Trigger harvest dari popup → check log `Extracted N valid products. Skipped: M`
6. Verifikasi di Supabase: kolom `name_raw` ≠ `product_name`, `price_min`/`price_max` terisi untuk varian, `original_price` null saat tidak diskon
