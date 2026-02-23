-- Tạo bảng lop_hoc_hoc_sinh (Chi tiết danh sách học sinh trong lớp học)
-- Bảng này lưu mối quan hệ giữa học sinh và lớp học, cho phép query dễ dàng hơn

CREATE TABLE IF NOT EXISTS public.lop_hoc_hoc_sinh (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    class_id TEXT NOT NULL, -- ID của lớp học (foreign key to lop_hoc)
    student_id TEXT NOT NULL, -- ID của học sinh (foreign key to danh_sach_hoc_sinh)
    student_name TEXT, -- Tên học sinh (denormalized để query nhanh)
    student_code TEXT, -- Mã học sinh (denormalized để query nhanh)
    hoc_phi_rieng NUMERIC, -- Học phí riêng theo học sinh trong lớp (override đơn giá)
    enrollment_date DATE, -- Ngày đăng ký vào lớp
    status TEXT DEFAULT 'active', -- Trạng thái: active, inactive, dropped
    notes TEXT, -- Ghi chú
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Đảm bảo mỗi học sinh chỉ có 1 record active trong 1 lớp
    CONSTRAINT unique_active_enrollment UNIQUE (class_id, student_id, status)
);

-- Tạo index cho các cột thường dùng để tìm kiếm
CREATE INDEX IF NOT EXISTS idx_lop_hoc_hoc_sinh_class_id ON public.lop_hoc_hoc_sinh(class_id);
CREATE INDEX IF NOT EXISTS idx_lop_hoc_hoc_sinh_student_id ON public.lop_hoc_hoc_sinh(student_id);
CREATE INDEX IF NOT EXISTS idx_lop_hoc_hoc_sinh_student_code ON public.lop_hoc_hoc_sinh(student_code);
CREATE INDEX IF NOT EXISTS idx_lop_hoc_hoc_sinh_status ON public.lop_hoc_hoc_sinh(status);
CREATE INDEX IF NOT EXISTS idx_lop_hoc_hoc_sinh_enrollment_date ON public.lop_hoc_hoc_sinh(enrollment_date);

-- Composite index để query danh sách học sinh trong lớp
CREATE INDEX IF NOT EXISTS idx_lop_hoc_hoc_sinh_class_status ON public.lop_hoc_hoc_sinh(class_id, status);

-- Tạo trigger để tự động cập nhật updated_at
CREATE TRIGGER update_lop_hoc_hoc_sinh_updated_at 
    BEFORE UPDATE ON public.lop_hoc_hoc_sinh
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Thêm foreign key constraints (optional - có thể bỏ nếu chưa có bảng danh_sach_hoc_sinh)
-- ALTER TABLE public.lop_hoc_hoc_sinh 
--     ADD CONSTRAINT fk_class_id 
--     FOREIGN KEY (class_id) REFERENCES public.lop_hoc(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE public.lop_hoc_hoc_sinh 
--     ADD CONSTRAINT fk_student_id 
--     FOREIGN KEY (student_id) REFERENCES public.danh_sach_hoc_sinh(id) ON DELETE CASCADE;

-- Thêm comment cho bảng và các cột quan trọng
COMMENT ON TABLE public.lop_hoc_hoc_sinh IS 'Bảng lưu trữ chi tiết danh sách học sinh trong từng lớp học';
COMMENT ON COLUMN public.lop_hoc_hoc_sinh.class_id IS 'ID của lớp học - tham chiếu đến bảng lop_hoc';
COMMENT ON COLUMN public.lop_hoc_hoc_sinh.student_id IS 'ID của học sinh - tham chiếu đến bảng danh_sach_hoc_sinh';
COMMENT ON COLUMN public.lop_hoc_hoc_sinh.hoc_phi_rieng IS 'Học phí riêng (override) theo học sinh trong từng lớp';
COMMENT ON COLUMN public.lop_hoc_hoc_sinh.enrollment_date IS 'Ngày học sinh đăng ký vào lớp';
COMMENT ON COLUMN public.lop_hoc_hoc_sinh.status IS 'Trạng thái: active (đang học), inactive (tạm nghỉ), dropped (đã rời lớp)';

-- Tạo view để query danh sách học sinh trong lớp dễ dàng hơn
CREATE OR REPLACE VIEW v_lop_hoc_hoc_sinh AS
SELECT 
    lhhs.id,
    lhhs.class_id,
    lh.ten_lop AS class_name,
    lh.ma_lop AS class_code,
    lh.mon_hoc AS subject,
    lh.khoi AS grade,
    lhhs.student_id,
    lhhs.student_name,
    lhhs.student_code,
    lhhs.hoc_phi_rieng,
    lhhs.enrollment_date,
    lhhs.status,
    lhhs.notes,
    lhhs.created_at,
    lhhs.updated_at
FROM public.lop_hoc_hoc_sinh lhhs
LEFT JOIN public.lop_hoc lh ON lhhs.class_id = lh.id
WHERE lhhs.status = 'active';

COMMENT ON VIEW v_lop_hoc_hoc_sinh IS 'View để query danh sách học sinh đang học trong các lớp (chỉ lấy status = active)';
