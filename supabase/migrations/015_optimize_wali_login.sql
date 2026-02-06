-- 1. Add normalized column
ALTER TABLE students ADD COLUMN IF NOT EXISTS wali_phone_normalized TEXT;

-- 2. Create index
CREATE INDEX IF NOT EXISTS idx_students_wali_phone_normalized ON students(wali_phone_normalized);

-- 3. Backfill data
UPDATE students SET wali_phone_normalized = normalize_phone(wali_phone);

-- 4. Create trigger function to maintain it
CREATE OR REPLACE FUNCTION maintain_wali_phone_normalized()
RETURNS TRIGGER AS $$
BEGIN
    NEW.wali_phone_normalized := normalize_phone(NEW.wali_phone);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger
DROP TRIGGER IF EXISTS tr_maintain_wali_phone_normalized ON students;
CREATE TRIGGER tr_maintain_wali_phone_normalized
BEFORE INSERT OR UPDATE OF wali_phone ON students
FOR EACH ROW
EXECUTE FUNCTION maintain_wali_phone_normalized();

-- 6. Optimize get_wali_children_by_phone
CREATE OR REPLACE FUNCTION get_wali_children_by_phone(phone_input TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    halaqah TEXT,
    status TEXT,
    average_score DECIMAL
) AS $$
DECLARE
    norm_phone TEXT;
BEGIN
    norm_phone := normalize_phone(phone_input);

    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.halaqah,
        s.status,
        s.average_score
    FROM students s
    WHERE s.wali_phone_normalized = norm_phone; -- Uses Index!
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Optimize login_wali
DROP FUNCTION IF EXISTS login_wali(text, text);
CREATE OR REPLACE FUNCTION login_wali(phone_input TEXT, password_input TEXT)
RETURNS TABLE (
    id UUID,
    phone TEXT,
    name TEXT,
    role TEXT
) AS $$
DECLARE
    norm_phone TEXT;
BEGIN
    norm_phone := normalize_phone(phone_input);
    
    -- Optimized check using index: verify at least one student exists for this wali
    PERFORM 1 FROM students WHERE wali_phone_normalized = norm_phone LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        ws.id,
        ws.phone,
        ws.name,
        'wali'::text as role
    FROM wali_santri ws
    WHERE ws.phone = norm_phone
      AND ws.password = password_input
      AND ws.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
