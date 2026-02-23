-- ============================================
-- THÊM CỘT SUBJECT (MÔN HỌC) VÀO BẢNG PHIEU_THU_HOC_PHI_CHI_TIET
-- Script này đảm bảo cột subject tồn tại và có index
-- ============================================

-- BƯỚC 1: Kiểm tra bảng có tồn tại không
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'phieu_thu_hoc_phi_chi_tiet'
    ) THEN
        RAISE EXCEPTION 'Bảng phieu_thu_hoc_phi_chi_tiet chưa được tạo! Vui lòng chạy create_phieu_thu_hoc_phi_chi_tiet_table.sql trước';
    END IF;
END $$;

-- BƯỚC 2: Thêm cột subject nếu chưa có
ALTER TABLE public.phieu_thu_hoc_phi_chi_tiet
ADD COLUMN IF NOT EXISTS subject TEXT;

-- BƯỚC 3: Thêm comment cho cột
COMMENT ON COLUMN public.phieu_thu_hoc_phi_chi_tiet.subject IS 'Môn học';

-- BƯỚC 4: Tạo index cho cột subject để query nhanh hơn
CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_chi_tiet_subject 
    ON public.phieu_thu_hoc_phi_chi_tiet(subject);

-- BƯỚC 5: Composite index để query theo student + subject
CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_chi_tiet_student_subject 
    ON public.phieu_thu_hoc_phi_chi_tiet(student_id, subject);

-- BƯỚC 6: Composite index để query theo student + month + year + subject
CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_chi_tiet_student_month_year_subject 
    ON public.phieu_thu_hoc_phi_chi_tiet(student_id, month, year, subject);

-- BƯỚC 7: Cập nhật view để đảm bảo có subject
CREATE OR REPLACE VIEW public.v_phieu_thu_hoc_phi_chi_tiet AS
SELECT 
    id,
    student_id,
    student_name,
    student_code,
    class_id,
    class_name,
    class_code,
    subject, -- Đảm bảo subject có trong view
    month,
    year,
    total_sessions,
    price_per_session,
    total_amount,
    discount,
    final_amount,
    status,
    invoice_image,
    debt,
    paid_at,
    notes,
    created_at,
    updated_at
FROM public.phieu_thu_hoc_phi_chi_tiet
ORDER BY student_id, month, year, subject, class_name;

-- BƯỚC 8: Hiển thị kết quả
SELECT 
    'Cột subject đã được thêm/cập nhật thành công' as status,
    COUNT(*) as total_records
FROM public.phieu_thu_hoc_phi_chi_tiet;
