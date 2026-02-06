-- Migration to add admin-guru assignment relationship

-- 1. Create assignment table
CREATE TABLE admin_guru_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    guru_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(admin_id, guru_id)
);

-- 2. Enable RLS
ALTER TABLE admin_guru_assignments ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Super Admin can view/manage all assignments
CREATE POLICY "Super Admin can manage assignments" ON admin_guru_assignments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Admins can view their own assignments
CREATE POLICY "Admins can view their assignments" ON admin_guru_assignments
    FOR SELECT TO authenticated
    USING (admin_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
