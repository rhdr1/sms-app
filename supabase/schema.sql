-- ================================================
-- SISTEM MANAJEMEN SANTRI (SMS) - Database Schema
-- Run this in Supabase SQL Editor
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- 1. PROFILES TABLE (Ustadz/Admin - for Auth users)
-- ================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ustadz' CHECK (role IN ('admin', 'ustadz', 'super_admin')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- ================================================
-- 1B. TEACHERS TABLE (Standalone - for Admin management)
-- ================================================
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    specialization TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view teachers" ON teachers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert teachers" ON teachers
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update teachers" ON teachers
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete teachers" ON teachers
    FOR DELETE TO authenticated USING (true);

-- ================================================
-- 1C. HALAQAH TABLE (Groups with Teacher Assignment)
-- ================================================
CREATE TABLE halaqah (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    description TEXT,
    max_students INTEGER NOT NULL DEFAULT 12,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE halaqah ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all for halaqah" ON halaqah FOR ALL USING (true) WITH CHECK (true);

-- ================================================
-- 2. STUDENTS TABLE
-- ================================================
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    halaqah TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Mutawassith' CHECK (status IN ('Mutqin', 'Mutawassith', 'Dhaif')),
    average_score DECIMAL(5,2) DEFAULT 0,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Policies (All authenticated users can read students)
CREATE POLICY "Authenticated users can view students" ON students
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert students" ON students
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update students" ON students
    FOR UPDATE TO authenticated USING (true);

-- ================================================
-- 3. CURRICULUM ITEMS TABLE
-- ================================================
CREATE TABLE curriculum_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL CHECK (category IN ('Surah', 'Juz', 'Kitab', 'Mandzumah')),
    name TEXT NOT NULL,
    target_ayat INTEGER,
    page_start INTEGER,
    page_end INTEGER,
    surah_number INTEGER,
    ayat_start INTEGER,
    ayat_end INTEGER,
    total_pages INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE curriculum_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view curriculum" ON curriculum_items
    FOR SELECT TO authenticated USING (true);

-- ================================================
-- 4. DAILY SCORES TABLE (Transactions)
-- ================================================
CREATE TABLE daily_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    ustadz_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    curriculum_id UUID REFERENCES curriculum_items(id) ON DELETE SET NULL,
    adab INTEGER NOT NULL CHECK (adab >= 0 AND adab <= 100),
    disiplin INTEGER NOT NULL CHECK (disiplin >= 0 AND disiplin <= 100),
    setoran INTEGER NOT NULL CHECK (setoran >= 0 AND setoran <= 100),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE daily_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scores" ON daily_scores
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert scores" ON daily_scores
    FOR INSERT TO authenticated WITH CHECK (true);

-- ================================================
-- 5. FUNCTION: Calculate & Update Student Status
-- ================================================
CREATE OR REPLACE FUNCTION calculate_student_status()
RETURNS TRIGGER AS $$
DECLARE
    avg_score DECIMAL(5,2);
    new_status TEXT;
BEGIN
    -- Calculate average of last 7 days
    SELECT AVG((adab + disiplin + setoran) / 3.0)
    INTO avg_score
    FROM daily_scores
    WHERE student_id = NEW.student_id
      AND created_at >= NOW() - INTERVAL '7 days';

    -- Determine status based on average
    IF avg_score >= 90 THEN
        new_status := 'Mutqin';
    ELSIF avg_score < 65 THEN
        new_status := 'Dhaif';
    ELSE
        new_status := 'Mutawassith';
    END IF;

    -- Update student record
    UPDATE students
    SET status = new_status,
        average_score = avg_score,
        updated_at = NOW()
    WHERE id = NEW.student_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 6. TRIGGER: Auto-update status after score insert
-- ================================================
CREATE TRIGGER on_score_insert
    AFTER INSERT ON daily_scores
    FOR EACH ROW
    EXECUTE FUNCTION calculate_student_status();

-- ================================================
-- 7. SEED DATA (Optional - for testing)
-- ================================================
-- Insert sample curriculum items
INSERT INTO curriculum_items (category, name, target_ayat) VALUES
    ('Surah', 'Al-Fatihah', 7),
    ('Surah', 'An-Nas', 6),
    ('Surah', 'Al-Falaq', 5),
    ('Surah', 'Al-Ikhlas', 4),
    ('Juz', 'Juz 30 (Amma)', 564);


-- ================================================
-- 8. SESSIONS REF TABLE (For Assessment Sessions)
-- ================================================
CREATE TABLE sessions_ref (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    time_start TIME,
    time_end TIME,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sessions_ref ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view sessions_ref" ON sessions_ref
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage sessions_ref" ON sessions_ref
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================
-- 9. CRITERIA REF TABLE (Adab & Discipline)
-- ================================================
CREATE TABLE criteria_ref (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    aspect TEXT NOT NULL CHECK (aspect IN ('adab', 'discipline')),
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE criteria_ref ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view criteria_ref" ON criteria_ref
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage criteria_ref" ON criteria_ref
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================
-- 10. DAILY ASSESSMENTS TABLE (Checklist)
-- ================================================
CREATE TABLE daily_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id BIGINT REFERENCES sessions_ref(id) ON DELETE RESTRICT,
    criteria_id BIGINT REFERENCES criteria_ref(id) ON DELETE RESTRICT,
    is_compliant BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(date, student_id, session_id, criteria_id)
);

-- Enable RLS
ALTER TABLE daily_assessments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view assessments" ON daily_assessments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage assessments" ON daily_assessments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed Sessions
INSERT INTO sessions_ref (name, time_start, time_end, sort_order) VALUES
    ('Sesi 1 (Pagi)', '07:00', '08:00', 1),
    ('Sesi 2 (Dhuha)', '08:00', '11:00', 2),
    ('Sesi 3 (Siang)', '13:00', '15:00', 3);

-- Seed Criteria
INSERT INTO criteria_ref (aspect, title, description, sort_order) VALUES
    ('discipline', 'Kehadiran', 'Santri hadir tepat waktu', 1),
    ('discipline', 'Seragam', 'Memakai seragam lengkap dan rapi', 2),
    ('adab', 'Membawa Al-Quran', 'Membawa mushaf sendiri', 1),
    ('adab', 'Tenang & Fokus', 'Tidak ribut dan fokus menghafal', 2);
