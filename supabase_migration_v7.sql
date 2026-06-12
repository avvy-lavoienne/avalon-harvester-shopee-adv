-- =========================================================================
-- Avalon Harvester — Schema Migration v7
-- Atomic claim untuk mencegah TOCTOU race condition di multi-worker
-- JALANKAN di Supabase SQL Editor SETELAH v6
-- =========================================================================

CREATE OR REPLACE FUNCTION claim_pending_rows(batch_size INTEGER)
RETURNS SETOF shopee_products
LANGUAGE sql
AS $$
  UPDATE shopee_products0000000000000000000000000000
  SET cleaning_status = 'processing'
  WHERE id IN (
    SELECT id FROM shopee_products
    WHERE cleaning_status IS NULL OR cleaning_status = 'pending'
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

COMMENT ON FUNCTION claim_pending_rows IS
  'Atomic claim: SELECT + LOCK + UPDATE status ke processing dalam 1 query. Mencegah 2 worker mengerjakan row yang sama.';

-- Migration untuk shopee_category_cache (future use)
CREATE TABLE IF NOT EXISTS public.shopee_category_cache (
  catid        BIGINT PRIMARY KEY,
  name         TEXT NOT NULL,
  parent_catid BIGINT DEFAULT 0,
  level        INTEGER DEFAULT 1,
  no_sub       BOOLEAN DEFAULT false,
  url          TEXT,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shopee_category_cache IS
  'Cache kategori Shopee dari API /api/v2/search/categories, di-populate oleh extension atau worker.';

-- Tambah kolom max_pages untuk tabel harvesting_keywords (jika belum ada)
ALTER TABLE public.harvesting_keywords ADD COLUMN IF NOT EXISTS max_pages INTEGER DEFAULT 12;
COMMENT ON COLUMN public.harvesting_keywords.max_pages IS 'Jumlah maksimal halaman yang akan di-scrape (default 12)';
