-- ================================================
-- Migration: 009_wali_santri.sql
-- Dashboard Wali Santri + Pengumuman
-- ================================================

-- ================================================
-- 1. WALI SANTRI TABLE (Parent/Guardian Accounts)
-- ================================================
CREATE TABLE wali_santri (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL UNIQUE,           -- Nomor HP format 08xxx (username)
    password TEXT NOT NULL,               -- Password (default: 6 digit terakhir)
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE wali_santri ENABLE ROW LEVEL SECURITY;

-- Policies - Allow authenticated users (admin/ustadz) to manage wali
CREATE POLICY "Authenticated users can view wali_santri" ON wali_santri
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert wali_santri" ON wali_santri
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update wali_santri" ON wali_santri
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete wali_santri" ON wali_santri
    FOR DELETE TO authenticated USING (true);

-- ================================================
-- 2. WALI-SANTRI JUNCTION TABLE (1 wali : many children)
-- ================================================
CREATE TABLE wali_santri_children (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wali_id UUID NOT NULL REFERENCES wali_santri(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(wali_id, student_id)
);

-- Enable RLS
ALTER TABLE wali_santri_children ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view wali_santri_children" ON wali_santri_children
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert wali_santri_children" ON wali_santri_children
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update wali_santri_children" ON wali_santri_children
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete wali_santri_children" ON wali_santri_children
    FOR DELETE TO authenticated USING (true);

-- ================================================
-- 3. ANNOUNCEMENTS TABLE (Pengumuman)
-- ================================================
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view announcements" ON announcements
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage announcements" ON announcements
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================
-- 4. FUNCTION: Normalize phone number to 08 format
-- ================================================
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Remove all non-digit characters
    phone := regexp_replace(phone, '[^0-9]', '', 'g');
    
    -- Convert +62 to 0
    IF phone LIKE '62%' THEN
        phone := '0' || substring(phone from 3);
    END IF;
    
    -- Ensure starts with 08
    IF phone NOT LIKE '08%' AND phone LIKE '8%' THEN
        phone := '0' || phone;
    END IF;
    
    RETURN phone;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 5. FUNCTION: Get default password (last 6 digits)
-- ================================================
CREATE OR REPLACE FUNCTION get_default_wali_password(phone TEXT)
RETURNS TEXT AS $$
DECLARE
    clean_phone TEXT;
BEGIN
    clean_phone := normalize_phone(phone);
    RETURN right(clean_phone, 6);
END;
$$ LANGUAGE plpgsql;

-- Comment on tables
COMMENT ON TABLE wali_santri IS 'Akun wali santri untuk dashboard terpisah';
COMMENT ON TABLE wali_santri_children IS 'Relasi wali santri dengan anak-anak mereka';
COMMENT ON TABLE announcements IS 'Pengumuman dari admin untuk wali santri';
COMMENT ON FUNCTION normalize_phone IS 'Normalisasi format nomor HP ke 08xxx';
COMMENT ON FUNCTION get_default_wali_password IS 'Generate password default dari 6 digit terakhir nomor HP';
