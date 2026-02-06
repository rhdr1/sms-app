-- =====================================================
-- HSIBS Student Monitoring System
-- Absence Reason Tracking
-- Migration Script v3.0
-- =====================================================

-- Add absence_reason column to track why a student is absent
-- Values: 'sakit' (sick), 'izin' (permission), 'tanpa_keterangan' (no reason)
ALTER TABLE daily_assessments 
ADD COLUMN IF NOT EXISTS absence_reason VARCHAR(20) 
CHECK (absence_reason IS NULL OR absence_reason IN ('sakit', 'izin', 'tanpa_keterangan'));

-- Create index for faster queries on absence reason
CREATE INDEX IF NOT EXISTS idx_daily_assessments_absence_reason ON daily_assessments(absence_reason);

-- Optional: View to aggregate absence statistics per student
CREATE OR REPLACE VIEW student_absence_summary AS
SELECT 
    student_id,
    COUNT(*) FILTER (WHERE absence_reason = 'sakit') as sakit_count,
    COUNT(*) FILTER (WHERE absence_reason = 'izin') as izin_count,
    COUNT(*) FILTER (WHERE absence_reason = 'tanpa_keterangan') as tanpa_keterangan_count,
    COUNT(*) FILTER (WHERE absence_reason IS NOT NULL) as total_absences
FROM daily_assessments da
JOIN criteria_ref cr ON da.criteria_id = cr.id
WHERE cr.title ILIKE '%kehadiran%' 
  AND da.is_compliant = false
GROUP BY student_id;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
