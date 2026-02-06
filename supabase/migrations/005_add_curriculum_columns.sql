-- Add columns for Quran indexing and Kitab details
ALTER TABLE public.curriculum_items
ADD COLUMN surah_number INTEGER NULL,
ADD COLUMN ayat_start INTEGER NULL,
ADD COLUMN ayat_end INTEGER NULL,
ADD COLUMN page INTEGER NULL,
ADD COLUMN total_pages INTEGER NULL;

-- Add comment to explain columns
COMMENT ON COLUMN public.curriculum_items.surah_number IS 'Surah number (1-114) for Quran category';
COMMENT ON COLUMN public.curriculum_items.ayat_start IS 'Starting verse number for Quran category';
COMMENT ON COLUMN public.curriculum_items.ayat_end IS 'Ending verse number for Quran category';
COMMENT ON COLUMN public.curriculum_items.page IS 'Page number for Quran category';
COMMENT ON COLUMN public.curriculum_items.total_pages IS 'Total pages for Kitab category';
