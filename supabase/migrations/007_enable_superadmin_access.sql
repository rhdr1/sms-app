-- Enable Superadmin full access for key tables
-- Logic: Check if user has 'superadmin' role in profiles table

-- 1. Curriculum Items
-- Drop if exists to avoid errors on rerun
DROP POLICY IF EXISTS "Superadmin Full Access curriculum_items" ON "public"."curriculum_items";

CREATE POLICY "Superadmin Full Access curriculum_items" ON "public"."curriculum_items"
AS PERMISSIVE FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

-- 2. Students
DROP POLICY IF EXISTS "Superadmin Full Access students" ON "public"."students";

CREATE POLICY "Superadmin Full Access students" ON "public"."students"
AS PERMISSIVE FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

-- 3. Halaqah
DROP POLICY IF EXISTS "Superadmin Full Access halaqah" ON "public"."halaqah";

CREATE POLICY "Superadmin Full Access halaqah" ON "public"."halaqah"
AS PERMISSIVE FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

-- 4. Teachers
DROP POLICY IF EXISTS "Superadmin Full Access teachers" ON "public"."teachers";

CREATE POLICY "Superadmin Full Access teachers" ON "public"."teachers"
AS PERMISSIVE FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);

-- 5. Daily Scores
DROP POLICY IF EXISTS "Superadmin Full Access daily_scores" ON "public"."daily_scores";

CREATE POLICY "Superadmin Full Access daily_scores" ON "public"."daily_scores"
AS PERMISSIVE FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
  )
);
