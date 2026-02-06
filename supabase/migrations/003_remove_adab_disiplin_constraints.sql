-- =====================================================
-- Migration: Remove adab/disiplin NOT NULL constraints
-- and make columns optional (or remove them entirely)
-- 
-- Since adab/disiplin are now calculated from daily_assessments,
-- we need to update daily_scores to allow NULL values or remove the columns
-- =====================================================

-- Option 1: Make adab and disiplin columns optional (recommended for backward compatibility)
ALTER TABLE daily_scores 
    ALTER COLUMN adab DROP NOT NULL,
    ALTER COLUMN disiplin DROP NOT NULL;

-- Set default values for new inserts (will be NULL if not provided)
ALTER TABLE daily_scores 
    ALTER COLUMN adab SET DEFAULT NULL,
    ALTER COLUMN disiplin SET DEFAULT NULL;

-- Optional: Update existing trigger to only use setoran for status calculation
-- Since adab/disiplin are now from daily_assessments, we can simplify the trigger

CREATE OR REPLACE FUNCTION calculate_student_status()
RETURNS TRIGGER AS $$
DECLARE
    avg_setoran DECIMAL(5,2);
    new_status TEXT;
BEGIN
    -- Calculate average setoran from last 7 days
    SELECT AVG(setoran)
    INTO avg_setoran
    FROM daily_scores
    WHERE student_id = NEW.student_id
      AND created_at >= NOW() - INTERVAL '7 days';

    -- Determine status based on setoran average
    IF avg_setoran >= 90 THEN
        new_status := 'Mutqin';
    ELSIF avg_setoran < 65 THEN
        new_status := 'Dhaif';
    ELSE
        new_status := 'Mutawassith';
    END IF;

    -- Update student record
    UPDATE students
    SET status = new_status,
        average_score = avg_setoran,
        updated_at = NOW()
    WHERE id = NEW.student_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
