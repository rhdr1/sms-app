-- Migration: Add wali columns to students table

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS wali_name TEXT,
ADD COLUMN IF NOT EXISTS wali_phone TEXT;

COMMENT ON COLUMN students.wali_name IS 'Nama lengkap wali santri';
COMMENT ON COLUMN students.wali_phone IS 'Nomor telepon/WA wali santri';
