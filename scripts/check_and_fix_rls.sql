-- ============================================
-- KIỂM TRA VÀ SỬA RLS CHO CÁC BẢNG HỌC SINH
-- ============================================
-- Chạy script này để kiểm tra và đảm bảo RLS đã được tắt

-- 1. Kiểm tra trạng thái RLS hiện tại
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('hoc_sinh', 'gia_han', 'lich_su_sao_thuong')
ORDER BY tablename;

-- 2. TẮT RLS cho tất cả các bảng (nếu đang bật)
ALTER TABLE IF EXISTS public.hoc_sinh DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gia_han DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lich_su_sao_thuong DISABLE ROW LEVEL SECURITY;

-- 3. Xóa tất cả policies cũ (nếu có)
DROP POLICY IF EXISTS "Allow all for service role" ON public.hoc_sinh;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.hoc_sinh;
DROP POLICY IF EXISTS "Allow all for service role" ON public.gia_han;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.gia_han;
DROP POLICY IF EXISTS "Allow all for service role" ON public.lich_su_sao_thuong;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.lich_su_sao_thuong;

-- 4. Kiểm tra lại trạng thái RLS sau khi tắt
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('hoc_sinh', 'gia_han', 'lich_su_sao_thuong')
ORDER BY tablename;

-- Kết quả mong đợi: rls_enabled = false cho tất cả 3 bảng
