-- =========================================================================
-- Avalon Harvester — Schema Migration v3
-- Tambahkan kolom untuk Python worker post-processing
-- Run di Supabase SQL Editor SETELAH v2
-- =========================================================================

ALTER TABLE public.shopee_products
  ADD COLUMN IF NOT EXISTS category          TEXT,
  ADD COLUMN IF NOT EXISTS category_score    INTEGER,
  ADD COLUMN IF NOT EXISTS specs             JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cleaning_status   TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cleaning_method   TEXT,
  ADD COLUMN IF NOT EXISTS llm_used          BOOLEAN DEFAULT false;

-- Index untuk worker query (cleaning_status = pending) supaya cepat fetch
CREATE INDEX IF NOT EXISTS idx_shopee_products_cleaning_status
  ON public.shopee_products (cleaning_status)
  WHERE cleaning_status IN ('pending', 'processing');

-- Index untuk filter by category
CREATE INDEX IF NOT EXISTS idx_shopee_products_category
  ON public.shopee_products (category);

-- GIN index untuk query JSONB spec (misal cari semua RTX 4060)
CREATE INDEX IF NOT EXISTS idx_shopee_products_specs_gin
  ON public.shopee_products USING gin (specs);

-- Saat ada produk baru dari extension, otomatis set cleaning_status = 'pending'
-- (skip kalau tidak mau auto-process: hapus trigger ini)
CREATE OR REPLACE FUNCTION set_cleaning_pending()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cleaning_status IS NULL THEN
    NEW.cleaning_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_cleaning_pending ON public.shopee_products;
CREATE TRIGGER trg_set_cleaning_pending
  BEFORE INSERT ON public.shopee_products
  FOR EACH ROW
  EXECUTE FUNCTION set_cleaning_pending();
