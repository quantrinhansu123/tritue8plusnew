-- Thêm các cột còn thiếu vào bảng lop_hoc
-- Các cột này có trong Firebase nhưng chưa có trong schema Supabase

-- Thêm cột "Tài liệu"
ALTER TABLE public.lop_hoc 
ADD COLUMN IF NOT EXISTS tai_lieu TEXT;

-- Thêm cột "Địa điểm"
ALTER TABLE public.lop_hoc 
ADD COLUMN IF NOT EXISTS dia_diem TEXT;

-- Thêm comment cho các cột mới
COMMENT ON COLUMN public.lop_hoc.tai_lieu IS 'Tài liệu học tập của lớp';
COMMENT ON COLUMN public.lop_hoc.dia_diem IS 'Địa điểm học của lớp';
