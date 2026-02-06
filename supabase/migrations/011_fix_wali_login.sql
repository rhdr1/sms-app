-- Migration: 011_fix_wali_login.sql
-- Fix Wali Login and Data Access via RPC (Bypassing RLS safely)

-- 1. RPC: Login Wali
-- Returns the wali profile if phone/password match
CREATE OR REPLACE FUNCTION login_wali(phone_input TEXT, password_input TEXT)
RETURNS SETOF wali_santri AS $$
DECLARE
    norm_phone TEXT;
BEGIN
    -- Normalize phone input using existing function
    norm_phone := normalize_phone(phone_input);
    
    -- Optimize check: The phone MUST exist in the students table's wali_phone column
    -- This enforces the rule: "Only numbers stored in student data can login"
    -- Even if a wali_santri record exists (e.g. from history), they cannot login if no CURRENT student has this phone.
    PERFORM 1 FROM students WHERE normalize_phone(wali_phone) = norm_phone LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN; -- Return nothing (no rows) if not found in students
    END IF;

    RETURN QUERY
    SELECT * FROM wali_santri
    WHERE phone = norm_phone
      AND password = password_input
      AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to anon and authenticated
GRANT EXECUTE ON FUNCTION login_wali(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION login_wali(TEXT, TEXT) TO authenticated;


-- 2. RPC: Get Children for Wali
-- Returns list of students linked to the wali's phone
-- Using RETURNS TABLE is more robust for PostgREST than SETOF custom_type
DROP FUNCTION IF EXISTS get_wali_children_by_phone(TEXT);

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
    WHERE s.wali_phone = norm_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_wali_children_by_phone(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_wali_children_by_phone(TEXT) TO authenticated;


-- 3. RPC: Change Wali Password
CREATE OR REPLACE FUNCTION change_wali_password(
    wali_id_input UUID, 
    old_password TEXT, 
    new_password TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    target_id UUID;
BEGIN
    -- Verify old password
    SELECT id INTO target_id
    FROM wali_santri
    WHERE id = wali_id_input
      AND password = old_password;
      
    IF target_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Update password
    UPDATE wali_santri
    SET password = new_password,
        updated_at = NOW()
    WHERE id = target_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION change_wali_password(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION change_wali_password(UUID, TEXT, TEXT) TO authenticated;
