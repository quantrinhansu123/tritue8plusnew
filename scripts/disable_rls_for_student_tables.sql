-- ============================================
-- TẮT RLS (Row Level Security) CHO CÁC BẢNG HỌC SINH
-- ============================================
-- Chạy script này trong Supabase SQL Editor để cho phép truy cập dữ liệu

-- Tắt RLS cho bảng hoc_sinh
ALTER TABLE IF EXISTS public.hoc_sinh DISABLE ROW LEVEL SECURITY;

-- Tắt RLS cho bảng gia_han
ALTER TABLE IF EXISTS public.gia_han DISABLE ROW LEVEL SECURITY;

-- Tắt RLS cho bảng lich_su_sao_thuong
ALTER TABLE IF EXISTS public.lich_su_sao_thuong DISABLE ROW LEVEL SECURITY;

-- Nếu muốn bật RLS nhưng cho phép service role và authenticated users truy cập:
-- (Uncomment các dòng dưới nếu muốn dùng RLS với policies)

/*
-- Bật RLS cho bảng hoc_sinh
ALTER TABLE public.hoc_sinh ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.hoc_sinh
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Allow all for authenticated users" ON public.hoc_sinh
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Bật RLS cho bảng gia_han
ALTER TABLE public.gia_han ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.gia_han
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Allow all for authenticated users" ON public.gia_han
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Bật RLS cho bảng lich_su_sao_thuong
ALTER TABLE public.lich_su_sao_thuong ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.lich_su_sao_thuong
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Allow all for authenticated users" ON public.lich_su_sao_thuong
    FOR ALL
    USING (auth.role() = 'authenticated');
*/
