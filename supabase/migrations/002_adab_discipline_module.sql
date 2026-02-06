-- =====================================================
-- HSIBS Student Monitoring System
-- Adab & Discipline Assessment Module
-- Migration Script v2.0
-- =====================================================

-- 1. CRITERIA_REF TABLE (Master Data Kriteria)
-- =====================================================
CREATE TABLE IF NOT EXISTS criteria_ref (
  id SERIAL PRIMARY KEY,
  aspect VARCHAR(20) NOT NULL CHECK (aspect IN ('adab', 'discipline')),
  title VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE criteria_ref ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active criteria
CREATE POLICY "Anyone can view criteria" ON criteria_ref
  FOR SELECT USING (true);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Admins can manage criteria" ON criteria_ref
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- 2. SESSIONS_REF TABLE (Master Data Sesi Harian)
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions_ref (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  time_start TIME,
  time_end TIME,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sessions_ref ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active sessions
CREATE POLICY "Anyone can view sessions" ON sessions_ref
  FOR SELECT USING (true);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Admins can manage sessions" ON sessions_ref
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- 3. DAILY_ASSESSMENTS TABLE (Transaction Data)
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id INT NOT NULL REFERENCES sessions_ref(id) ON DELETE RESTRICT,
  criteria_id INT NOT NULL REFERENCES criteria_ref(id) ON DELETE RESTRICT,
  is_compliant BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one assessment per student/session/criteria/date
  UNIQUE(date, student_id, session_id, criteria_id)
);

-- Enable RLS
ALTER TABLE daily_assessments ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can view all assessments
CREATE POLICY "Teachers can view assessments" ON daily_assessments
  FOR SELECT USING (true);

-- Policy: Authenticated users can insert assessments
CREATE POLICY "Authenticated can insert assessments" ON daily_assessments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own assessments
CREATE POLICY "Users can update own assessments" ON daily_assessments
  FOR UPDATE USING (created_by = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_assessments_date ON daily_assessments(date);
CREATE INDEX IF NOT EXISTS idx_daily_assessments_student ON daily_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_daily_assessments_session ON daily_assessments(session_id);
CREATE INDEX IF NOT EXISTS idx_daily_assessments_created_by ON daily_assessments(created_by);

-- 4. SEED DATA: DISCIPLINE CRITERIA (6 items)
-- =====================================================
INSERT INTO criteria_ref (aspect, title, description, sort_order) VALUES
  ('discipline', 'Kehadiran', 'Hadir secara fisik di kelas/halaqah', 1),
  ('discipline', 'Ketepatan Waktu', 'Tiba sebelum atau tepat waktu mulai', 2),
  ('discipline', 'Seragam & Kerapian', 'Mengenakan seragam lengkap dan rapi sesuai jadwal', 3),
  ('discipline', 'Tertib Apel', 'Mengikuti Muqoddimah dengan khidmat', 4),
  ('discipline', 'Target Belajar', 'Mencapai target harian yang ditetapkan', 5),
  ('discipline', 'Mutolaah', 'Membaca materi yang ditentukan saat belajar mandiri', 6);

-- 5. SEED DATA: ADAB CRITERIA (6 items)
-- =====================================================
INSERT INTO criteria_ref (aspect, title, description, sort_order) VALUES
  ('adab', 'Fokus', 'Perhatian tertuju pada pelajaran/guru', 1),
  ('adab', 'Terjaga', 'Terjaga, duduk tegak, tidak mengantuk', 2),
  ('adab', 'Menghormati Guru', 'Patuh pada instruksi, sopan dalam merespons', 3),
  ('adab', 'Pandangan Terjaga', 'Menjaga pandangan, tidak menoleh-noleh', 4),
  ('adab', 'Diam', 'Tidak berbicara di luar konteks pembelajaran', 5),
  ('adab', 'Bahasa Arab', 'Menggunakan Bahasa Arab sesuai aturan/kemampuan', 6);

-- 6. SEED DATA: DAILY SESSIONS (4 sessions)
-- =====================================================
INSERT INTO sessions_ref (name, time_start, time_end, sort_order) VALUES
  ('Pagi', '05:00:00', '07:00:00', 1),
  ('Kelas', '08:00:00', '12:00:00', 2),
  ('Siang', '14:00:00', '16:00:00', 3),
  ('Malam', '19:00:00', '21:00:00', 4);

-- 7. FUNCTION: Calculate Daily Score
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_daily_score(
  p_student_id UUID,
  p_date DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_total_criteria INT;
  v_total_sessions INT;
  v_compliant_count INT;
  v_max_points INT;
  v_score NUMERIC;
BEGIN
  -- Get count of active criteria
  SELECT COUNT(*) INTO v_total_criteria 
  FROM criteria_ref WHERE is_active = true;
  
  -- Get count of active sessions
  SELECT COUNT(*) INTO v_total_sessions 
  FROM sessions_ref WHERE is_active = true;
  
  -- Calculate max possible points
  v_max_points := v_total_criteria * v_total_sessions;
  
  -- Get compliant count for this student on this date
  SELECT COUNT(*) INTO v_compliant_count
  FROM daily_assessments da
  JOIN criteria_ref cr ON da.criteria_id = cr.id
  JOIN sessions_ref sr ON da.session_id = sr.id
  WHERE da.student_id = p_student_id
    AND da.date = p_date
    AND da.is_compliant = true
    AND cr.is_active = true
    AND sr.is_active = true;
  
  -- Calculate score (0-100)
  IF v_max_points > 0 THEN
    v_score := (v_compliant_count::NUMERIC / v_max_points) * 100;
  ELSE
    v_score := 0;
  END IF;
  
  RETURN ROUND(v_score, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
