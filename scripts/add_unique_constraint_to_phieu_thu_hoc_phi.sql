-- ============================================
-- THÊM UNIQUE CONSTRAINT VÀO BẢNG PHIEU_THU_HOC_PHI
-- Đảm bảo mỗi học sinh chỉ có 1 invoice tổng hợp cho mỗi tháng/năm
-- ============================================

-- BƯỚC 1: Kiểm tra bảng có tồn tại không
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'phieu_thu_hoc_phi'
    ) THEN
        RAISE EXCEPTION 'Bảng phieu_thu_hoc_phi chưa được tạo! Vui lòng tạo bảng trước.';
    END IF;
END $$;

-- BƯỚC 2: Xóa constraint cũ nếu có (để tránh lỗi khi chạy lại)
ALTER TABLE public.phieu_thu_hoc_phi
DROP CONSTRAINT IF EXISTS unique_student_month_year;

-- BƯỚC 3: Xóa các records trùng lặp trước khi thêm constraint (giữ lại record mới nhất)
DELETE FROM public.phieu_thu_hoc_phi p1
WHERE EXISTS (
    SELECT 1
    FROM public.phieu_thu_hoc_phi p2
    WHERE p2.student_id = p1.student_id
      AND p2.month = p1.month
      AND p2.year = p1.year
      AND p2.id != p1.id
      AND (
          p2.created_at > p1.created_at
          OR (p2.created_at = p1.created_at AND p2.id > p1.id)
      )
);

-- BƯỚC 4: Thêm UNIQUE constraint
ALTER TABLE public.phieu_thu_hoc_phi
ADD CONSTRAINT unique_student_month_year UNIQUE (student_id, month, year);

-- BƯỚC 5: Tạo index để tối ưu query
CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_student_month_year 
    ON public.phieu_thu_hoc_phi(student_id, month, year);

-- BƯỚC 6: Kiểm tra constraint đã được tạo
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'phieu_thu_hoc_phi'::regclass
    AND conname = 'unique_student_month_year';
