-- ============================================
-- SCRIPT HOÀN CHỈNH: TẠO BẢNG + TẮT RLS + ENABLE REALTIME
-- ============================================
-- Chạy script này trong Supabase SQL Editor để setup đầy đủ

-- 1. Tạo function update_updated_at_column (nếu chưa có)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Tạo bảng hoc_sinh
CREATE TABLE IF NOT EXISTS public.hoc_sinh (
    id TEXT PRIMARY KEY,
    ho_va_ten TEXT NOT NULL,
    ma_hoc_sinh TEXT,
    ngay_sinh DATE,
    gioi_tinh TEXT,
    so_dien_thoai TEXT,
    sdt_phu_huynh TEXT,
    ho_ten_phu_huynh TEXT,
    dia_chi TEXT,
    truong TEXT,
    khoi TEXT,
    email TEXT,
    username TEXT,
    password TEXT,
    diem_so NUMERIC,
    trang_thai TEXT DEFAULT 'active',
    so_gio_da_gia_han NUMERIC DEFAULT 0,
    so_gio_con_lai NUMERIC DEFAULT 0,
    so_gio_da_hoc NUMERIC DEFAULT 0,
    ghi_chu TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tạo bảng gia_han
CREATE TABLE IF NOT EXISTS public.gia_han (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    student_id TEXT NOT NULL,
    gio_da_hoc TEXT,
    gio_con_lai TEXT,
    gio_nhap_them NUMERIC,
    nguoi_nhap TEXT,
    ngay_nhap DATE,
    gio_nhap TIME,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    adjustment_type TEXT,
    old_total NUMERIC,
    new_total NUMERIC,
    note TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tạo bảng lich_su_sao_thuong
CREATE TABLE IF NOT EXISTS public.lich_su_sao_thuong (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    student_id TEXT NOT NULL,
    thay_doi NUMERIC,
    so_sao_truoc NUMERIC,
    so_sao_sau NUMERIC,
    ly_do TEXT,
    nguoi_chinh_sua TEXT,
    ngay_chinh_sua DATE,
    gio_chinh_sua TIME,
    loai_thay_doi TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tạo indexes
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_ma_hoc_sinh ON public.hoc_sinh(ma_hoc_sinh);
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_ho_va_ten ON public.hoc_sinh(ho_va_ten);
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_trang_thai ON public.hoc_sinh(trang_thai);
CREATE INDEX IF NOT EXISTS idx_gia_han_student_id ON public.gia_han(student_id);
CREATE INDEX IF NOT EXISTS idx_gia_han_timestamp ON public.gia_han(timestamp);
CREATE INDEX IF NOT EXISTS idx_lich_su_sao_thuong_student_id ON public.lich_su_sao_thuong(student_id);
CREATE INDEX IF NOT EXISTS idx_lich_su_sao_thuong_timestamp ON public.lich_su_sao_thuong(timestamp);

-- 6. Tạo trigger cho updated_at
DROP TRIGGER IF EXISTS update_hoc_sinh_updated_at ON public.hoc_sinh;
CREATE TRIGGER update_hoc_sinh_updated_at 
    BEFORE UPDATE ON public.hoc_sinh
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. TẮT RLS (Row Level Security) để cho phép truy cập
ALTER TABLE IF EXISTS public.hoc_sinh DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gia_han DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lich_su_sao_thuong DISABLE ROW LEVEL SECURITY;

-- 8. ENABLE REALTIME cho các bảng
ALTER PUBLICATION supabase_realtime ADD TABLE public.hoc_sinh;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gia_han;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lich_su_sao_thuong;

-- 9. Thêm comments
COMMENT ON TABLE public.hoc_sinh IS 'Bảng lưu trữ thông tin học sinh';
COMMENT ON TABLE public.gia_han IS 'Bảng lưu trữ lịch sử gia hạn giờ học cho học sinh';
COMMENT ON TABLE public.lich_su_sao_thuong IS 'Bảng lưu trữ lịch sử thay đổi sao thưởng cho học sinh';
