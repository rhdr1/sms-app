-- Normalize phones in wali_santri to ensure alignment with login_wali
UPDATE wali_santri
SET phone = normalize_phone(phone);

-- Optional: Add a check constraint or trigger to enforce normalization on future inserts?
-- For now, just fix the data.
