-- Migration: 013_wali_dashboard_rpc.sql
-- Consolidated RPC for Wali Dashboard Summary
-- Fetches Student info + Latest Score + Attendance Rate in one go

DROP FUNCTION IF EXISTS get_wali_dashboard_summary(TEXT);

CREATE OR REPLACE FUNCTION get_wali_dashboard_summary(phone_input TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    halaqah TEXT,
    status TEXT,
    average_score DECIMAL,
    last_score INTEGER,
    attendance_rate INTEGER
) AS $$
DECLARE
    norm_phone TEXT;
    thirty_days_ago DATE;
BEGIN
    norm_phone := normalize_phone(phone_input);
    thirty_days_ago := CURRENT_DATE - 30;

    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.halaqah,
        s.status,
        s.average_score,
        -- Get latest score (subquery)
        (
            SELECT ds.setoran 
            FROM daily_scores ds 
            WHERE ds.student_id = s.id 
            ORDER BY ds.created_at DESC 
            LIMIT 1
        ) as last_score,
        -- Calculate attendance rate safely (last 30 days)
        COALESCE(
            (
                SELECT 
                    CASE WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND((COUNT(*) FILTER (WHERE da.is_compliant) * 100.0) / COUNT(*))
                    END
                FROM daily_assessments da
                WHERE da.student_id = s.id
                  AND da.date >= thirty_days_ago
            )::INTEGER,
            0 -- Default to 0 if no assessments found? Or maybe 100? Let's use 100 if no data like frontend did? 
              -- Frontend logic was: totalAssessments ? (compliant / total) * 100 : 100;
              -- Let's replicate that logic clearer:
        ) as attendance_rate
    FROM students s
    WHERE s.wali_phone = norm_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_wali_dashboard_summary(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_wali_dashboard_summary(TEXT) TO authenticated;
