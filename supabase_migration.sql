-- =========================================================================
-- Avalon Harvester — Supabase Schema Migration v2
-- Tambahkan kolom baru ke table shopee_products
-- Run di Supabase SQL Editor
-- =========================================================================

ALTER TABLE public.shopee_products
  ADD COLUMN IF NOT EXISTS name_raw   TEXT,
  ADD COLUMN IF NOT EXISTS price_min  NUMERIC,
  ADD COLUMN IF NOT EXISTS price_max  NUMERIC;

-- Index opsional untuk query analitik
CREATE INDEX IF NOT EXISTS idx_shopee_products_brand
  ON public.shopee_products (brand);

CREATE INDEX IF NOT EXISTS idx_shopee_products_search_query
  ON public.shopee_products (search_query);

CREATE INDEX IF NOT EXISTS idx_shopee_products_scraped_at
  ON public.shopee_products (scraped_at DESC);

-- Constraint unique pada item_id (kalau belum ada) — wajib untuk on_conflict
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shopee_products_item_id_key'
  ) THEN
    ALTER TABLE public.shopee_products
      ADD CONSTRAINT shopee_products_item_id_key UNIQUE (item_id);
  END IF;
END $$;
