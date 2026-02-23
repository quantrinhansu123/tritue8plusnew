-- Thêm cột "Học phí riêng" vào bảng lop_hoc_hoc_sinh (nếu bảng đã tạo trước đó)
-- Đồng thời cập nhật lại view v_lop_hoc_hoc_sinh để include cột mới

ALTER TABLE public.lop_hoc_hoc_sinh
ADD COLUMN IF NOT EXISTS hoc_phi_rieng NUMERIC;

COMMENT ON COLUMN public.lop_hoc_hoc_sinh.hoc_phi_rieng IS 'Học phí riêng (override) theo học sinh trong từng lớp';

-- Update view để hiển thị học phí riêng
CREATE OR REPLACE VIEW public.v_lop_hoc_hoc_sinh AS
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

COMMENT ON VIEW public.v_lop_hoc_hoc_sinh IS 'View để query danh sách học sinh đang học trong các lớp (chỉ lấy status = active)';

