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