-- Tạo bảng lop_hoc (Lớp học) trong Supabase
-- Bảng này chứa thông tin các lớp học, đặc biệt là "Học phí mỗi buổi" để lấy đơn giá

CREATE TABLE IF NOT EXISTS public.lop_hoc (
    id TEXT PRIMARY KEY,
    ten_lop TEXT, -- "Tên lớp"
    ma_lop TEXT, -- "Mã lớp"
    mon_hoc TEXT, -- "Môn học"
    khoi TEXT, -- "Khối"
    giao_vien_chu_nhiem TEXT, -- "Giáo viên chủ nhiệm"
    teacher_id TEXT, -- "Teacher ID"
    phong_hoc TEXT, -- "Phòng học"
    luong_gv NUMERIC, -- "Lương GV"
    hoc_phi_moi_buoi NUMERIC, -- "Học phí mỗi buổi" - QUAN TRỌNG cho đơn giá
    ghi_chu TEXT, -- "Ghi chú"
    trang_thai TEXT DEFAULT 'active', -- "Trạng thái" (active | inactive)
    ngay_tao TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- "Ngày tạo"
    nguoi_tao TEXT, -- "Người tạo"
    lich_hoc JSONB, -- "Lịch học" - Array of ClassSchedule objects
    hoc_sinh JSONB, -- "Học sinh" - Array of student names
    student_ids JSONB, -- "Student IDs" - Array of student IDs
    student_enrollments JSONB, -- "Student Enrollments" - Object tracking enrollment dates
    ngay_bat_dau DATE, -- "Ngày bắt đầu"
    ngay_ket_thuc DATE, -- "Ngày kết thúc"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo index cho các cột thường dùng để tìm kiếm
CREATE INDEX IF NOT EXISTS idx_lop_hoc_ma_lop ON public.lop_hoc(ma_lop);
CREATE INDEX IF NOT EXISTS idx_lop_hoc_mon_hoc ON public.lop_hoc(mon_hoc);
CREATE INDEX IF NOT EXISTS idx_lop_hoc_khoi ON public.lop_hoc(khoi);
CREATE INDEX IF NOT EXISTS idx_lop_hoc_teacher_id ON public.lop_hoc(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lop_hoc_trang_thai ON public.lop_hoc(trang_thai);

-- Tạo trigger để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lop_hoc_updated_at 
    BEFORE UPDATE ON public.lop_hoc
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Thêm comment cho bảng và các cột quan trọng
COMMENT ON TABLE public.lop_hoc IS 'Bảng lưu trữ thông tin các lớp học';
COMMENT ON COLUMN public.lop_hoc.hoc_phi_moi_buoi IS 'Học phí mỗi buổi - dùng để tính đơn giá cho invoice';
COMMENT ON COLUMN public.lop_hoc.ma_lop IS 'Mã lớp - dùng để match với hoc_phi_rieng';
COMMENT ON COLUMN public.lop_hoc.mon_hoc IS 'Môn học - dùng để match với khoa_hoc';
