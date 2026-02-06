-- Migration to add super_admin role support
-- Run this to allow super_admin role in existing database

-- Drop existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with super_admin
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'ustadz', 'super_admin'));

-- Optional: Update specific user to super_admin if needed
-- UPDATE profiles SET role = 'super_admin' WHERE email = 'your-super-admin@example.com';
