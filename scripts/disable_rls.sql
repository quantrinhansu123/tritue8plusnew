-- ============================================
-- TẮT RLS (Row Level Security) CHO BẢNG PHIẾU THU HỌC PHÍ
-- ============================================
-- Chạy script này trong Supabase SQL Editor nếu gặp lỗi permission

-- Tắt RLS cho bảng Phieu_thu_hoc_phi
ALTER TABLE Phieu_thu_hoc_phi DISABLE ROW LEVEL SECURITY;

-- Hoặc nếu muốn bật RLS nhưng cho phép service role truy cập:
-- ALTER TABLE Phieu_thu_hoc_phi ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Allow all for service role" ON Phieu_thu_hoc_phi
--     FOR ALL
--     USING (auth.role() = 'service_role');
--
-- CREATE POLICY "Allow all for authenticated users" ON Phieu_thu_hoc_phi
--     FOR ALL
--     USING (auth.role() = 'authenticated');
