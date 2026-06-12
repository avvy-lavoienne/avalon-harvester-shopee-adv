-- =========================================================================
-- Avalon Harvester — Schema Migration v6
-- Facet/Category Mode: kolom baru di harvesting_keywords
-- JALANKAN di Supabase SQL Editor SETELAH v5
-- =========================================================================

ALTER TABLE public.harvesting_keywords
  ADD COLUMN IF NOT EXISTS facet_id  BIGINT,
  ADD COLUMN IF NOT EXISTS price_min INTEGER,
  ADD COLUMN IF NOT EXISTS price_max INTEGER,
  ADD COLUMN IF NOT EXISTS sort_by   TEXT DEFAULT 'ctime',
  ADD COLUMN IF NOT EXISTS scenario  TEXT DEFAULT 'PAGE_OTHERS';

COMMENT ON COLUMN public.harvesting_keywords.facet_id IS
  'ID kategori Shopee (dari /api/v2/search/categories). NULL = pakai keyword biasa.';

COMMENT ON COLUMN public.harvesting_keywords.price_min IS
  'Filter harga minimum (dalam Rupiah). NULL = tidak dipakai.';

COMMENT ON COLUMN public.harvesting_keywords.price_max IS
  'Filter harga maksimum (dalam Rupiah). NULL = tidak dipakai.';

COMMENT ON COLUMN public.harvesting_keywords.sort_by IS
  'Mode sorting: ctime (terbaru), sales (terlaris), price (termurah). Default: ctime.';

COMMENT ON COLUMN public.harvesting_keywords.scenario IS
  'Jenis halaman: PAGE_CATEGORY (browse kategori) atau PAGE_OTHERS (search biasa). Default: PAGE_OTHERS.';

-- Index untuk query facet-based tasks
CREATE INDEX IF NOT EXISTS idx_harvesting_keywords_facet_id
  ON public.harvesting_keywords (facet_id)
  WHERE facet_id IS NOT NULL;

COMMENT ON INDEX public.idx_harvesting_keywords_facet_id IS
  'Mempercepat query task yang menggunakan facet/category mode.';
