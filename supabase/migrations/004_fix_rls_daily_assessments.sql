-- Relax RLS policy for daily_assessments to allow teachers to update assessments
-- Previously, only the creator could update, which caused issues if the teacher changed 
-- or if the record was created by someone else (e.g. admin/seed).

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can update own assessments" ON daily_assessments;

-- Create a new permissive policy for updates (Authenticated users can update)
-- Ideally this should be filtered by Halaqah, but for now we trust authenticated teachers.
CREATE POLICY "Authenticated can update assessments" ON daily_assessments
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Also ensure SELECT is explicit for authenticated only (security best practice)
DROP POLICY IF EXISTS "Teachers can view assessments" ON daily_assessments;
CREATE POLICY "Authenticated can view assessments" ON daily_assessments
  FOR SELECT USING (auth.uid() IS NOT NULL);
