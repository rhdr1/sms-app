-- Migration: 010_auto_sync_wali.sql
-- Auto-sync Wali Santri data from students table

-- 1. Create Function to Sync Student -> Wali
CREATE OR REPLACE FUNCTION sync_student_to_wali()
RETURNS TRIGGER AS $$
DECLARE
    clean_phone TEXT;
    default_pass TEXT;
    wali_id_val UUID;
BEGIN
    -- Only proceed if wali_phone is present
    IF NEW.wali_phone IS NULL OR LENGTH(trim(NEW.wali_phone)) < 10 THEN
        RETURN NEW;
    END IF;

    -- Normalize phone using existing function
    -- Note: We assume normalize_phone function exists from 009_wali_santri.sql
    clean_phone := normalize_phone(NEW.wali_phone);
    
    -- Safety check for normalization result
    IF clean_phone IS NULL OR LENGTH(clean_phone) < 10 THEN
        RETURN NEW;
    END IF;

    -- Generate default password
    default_pass := get_default_wali_password(clean_phone);

    -- 1. Upsert Wali Santri (Insert or Update Name)
    INSERT INTO wali_santri (phone, name, password)
    VALUES (clean_phone, COALESCE(NEW.wali_name, 'Wali Santri'), default_pass)
    ON CONFLICT (phone) 
    DO UPDATE SET 
        name = EXCLUDED.name, -- Update name to match latest input
        updated_at = NOW()
    RETURNING id INTO wali_id_val;

    -- 2. Link Student to Wali (Upsert into wali_santri_children)
    INSERT INTO wali_santri_children (wali_id, student_id)
    VALUES (wali_id_val, NEW.id)
    ON CONFLICT (wali_id, student_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS on_student_update_sync_wali ON students;

CREATE TRIGGER on_student_update_sync_wali
    AFTER INSERT OR UPDATE OF wali_name, wali_phone
    ON students
    FOR EACH ROW
    EXECUTE FUNCTION sync_student_to_wali();

-- 3. Backfill existing data (Optional - Run manually if needed, but safe to include for migration)
-- This will trigger the sync for all existing students with valid phone numbers
-- UPDATE students SET updated_at = NOW() WHERE wali_phone IS NOT NULL AND wali_phone != '';
