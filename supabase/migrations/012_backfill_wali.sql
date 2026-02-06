-- Migration: 012_backfill_wali.sql
-- Backfill wali_santri from existing students data

DO $$
BEGIN
    -- 1. Insert Wali Santri records (unique phones)
    INSERT INTO wali_santri (phone, name, password)
    SELECT DISTINCT
        normalize_phone(wali_phone) as phone,
        COALESCE(wali_name, 'Wali Santri') as name,
        get_default_wali_password(wali_phone) as password
    FROM students
    WHERE wali_phone IS NOT NULL 
      AND length(trim(wali_phone)) >= 10
    ON CONFLICT (phone) 
    DO UPDATE SET 
        name = EXCLUDED.name, -- Update name just in case
        updated_at = NOW();

    -- 2. Link Students to Wali (wali_santri_children)
    INSERT INTO wali_santri_children (wali_id, student_id)
    SELECT 
        ws.id,
        s.id
    FROM students s
    JOIN wali_santri ws ON ws.phone = normalize_phone(s.wali_phone)
    WHERE s.wali_phone IS NOT NULL 
      AND length(trim(s.wali_phone)) >= 10
    ON CONFLICT (wali_id, student_id) DO NOTHING;

END $$;
