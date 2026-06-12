-- =========================================================================
-- Avalon Harvester — Schema Migration v5
-- Multi-worker task distribution
-- =========================================================================

ALTER TABLE public.harvesting_keywords
ADD COLUMN IF NOT EXISTS assigned_to text;

COMMENT ON COLUMN public.harvesting_keywords.assigned_to IS
  'Username harvester yg sedang mengerjakan keyword ini. NULL = available.';

CREATE INDEX IF NOT EXISTS idx_harvesting_keywords_assigned_to
  ON public.harvesting_keywords (assigned_to);

-- Brand taxonomy: per-category known brands, auto-populated from keyword schema
CREATE TABLE IF NOT EXISTS public.brand_taxonomy (
    category TEXT NOT NULL,
    brand TEXT NOT NULL,
    source_keyword TEXT,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (category, brand)
);

COMMENT ON TABLE public.brand_taxonomy IS
  'Per-category brand whitelist, auto-populated from keyword_schemas schema->brands keys.';

CREATE INDEX IF NOT EXISTS idx_brand_taxonomy_category
  ON public.brand_taxonomy (category);