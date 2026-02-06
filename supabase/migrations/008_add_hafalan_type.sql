-- ================================================
-- Migration: Add hafalan_type to daily_scores
-- Purpose: Track whether each score entry is for new memorization or review
-- ================================================

-- Add hafalan_type column
ALTER TABLE daily_scores 
ADD COLUMN IF NOT EXISTS hafalan_type TEXT 
CHECK (hafalan_type IN ('baru', 'murojaah'));

-- Add index for better query performance when filtering by hafalan_type
CREATE INDEX IF NOT EXISTS idx_daily_scores_hafalan_type ON daily_scores(hafalan_type);

-- Comment for documentation
COMMENT ON COLUMN daily_scores.hafalan_type IS 'Type of memorization: baru (new) or murojaah (review)';
