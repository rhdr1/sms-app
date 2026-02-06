-- Migration: 014_fix_wali_children_fetch.sql
-- Fix get_wali_children_by_phone to normalize stored phone number

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
    WHERE normalize_phone(s.wali_phone) = norm_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_wali_children_by_phone(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_wali_children_by_phone(TEXT) TO authenticated;
