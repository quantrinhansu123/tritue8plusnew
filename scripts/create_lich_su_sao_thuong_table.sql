-- Tạo bảng lich_su_sao_thuong (Lịch sử sao thưởng) trong Supabase
-- Bảng này lưu trữ lịch sử thay đổi sao thưởng cho học sinh

CREATE TABLE IF NOT EXISTS public.lich_su_sao_thuong (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    student_id TEXT NOT NULL, -- ID học sinh (foreign key to hoc_sinh)
    thay_doi NUMERIC, -- "Thay đổi" (số sao thêm/bớt)
    so_sao_truoc NUMERIC, -- "Số sao trước"
    so_sao_sau NUMERIC, -- "Số sao sau"
    ly_do TEXT, -- "Lý do"
    nguoi_chinh_sua TEXT, -- "Người chỉnh sửa"
    ngay_chinh_sua DATE, -- "Ngày chỉnh sửa"
    gio_chinh_sua TIME, -- "Giờ chỉnh sửa"
    loai_thay_doi TEXT, -- "Loại thay đổi" (Điều chỉnh, Thưởng, Phạt, etc.)
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Timestamp
    metadata JSONB, -- Lưu các trường bổ sung khác
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo index cho các cột thường dùng để tìm kiếm
CREATE INDEX IF NOT EXISTS idx_lich_su_sao_thuong_student_id ON public.lich_su_sao_thuong(student_id);
CREATE INDEX IF NOT EXISTS idx_lich_su_sao_thuong_ngay_chinh_sua ON public.lich_su_sao_thuong(ngay_chinh_sua);
CREATE INDEX IF NOT EXISTS idx_lich_su_sao_thuong_timestamp ON public.lich_su_sao_thuong(timestamp);

-- Thêm comment cho bảng
COMMENT ON TABLE public.lich_su_sao_thuong IS 'Bảng lưu trữ lịch sử thay đổi sao thưởng cho học sinh';
COMMENT ON COLUMN public.lich_su_sao_thuong.student_id IS 'ID học sinh - tham chiếu đến bảng hoc_sinh';
COMMENT ON COLUMN public.lich_su_sao_thuong.thay_doi IS 'Số sao thay đổi (có thể âm để trừ sao)';
