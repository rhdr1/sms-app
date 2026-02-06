-- Add 'superadmin' to the allowed values for the role column in profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'ustadz', 'superadmin'));
