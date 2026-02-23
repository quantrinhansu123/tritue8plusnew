-- ============================================
-- MIGRATE DỮ LIỆU TỪ PHIEU_THU_HOC_PHI SANG PHIEU_THU_HOC_PHI_CHI_TIET
-- Script này chuyển dữ liệu từ bảng cũ sang bảng chi tiết mới
-- ============================================

-- BƯỚC 1: Kiểm tra bảng cũ có tồn tại không
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'phieu_thu_hoc_phi'
    ) THEN
        RAISE NOTICE 'Bảng phieu_thu_hoc_phi không tồn tại, bỏ qua migration';
        RETURN;
    END IF;
END $$;

-- BƯỚC 2: Kiểm tra bảng mới đã được tạo chưa
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

-- BƯỚC 3: Migrate dữ liệu từ bảng cũ sang bảng mới
-- Chỉ migrate các record chưa tồn tại trong bảng mới (tránh duplicate)
INSERT INTO public.phieu_thu_hoc_phi_chi_tiet (
    id,
    student_id,
    student_name,
    student_code,
    class_id,
    class_name,
    class_code,
    subject,
    month,
    year,
    total_sessions,
    price_per_session,
    total_amount,
    discount,
    final_amount,
    status,
    sessions,
    invoice_image,
    debt,
    paid_at,
    notes,
    metadata,
    created_at,
    updated_at
)
SELECT 
    -- Tạo ID mới theo format: {studentId}-{classId}-{month}-{year}
    COALESCE(
        p.id, -- Nếu ID cũ đã đúng format thì dùng
        CONCAT(
            COALESCE(p.student_id, ''),
            '-',
            COALESCE(p.class_id, ''),
            '-',
            COALESCE(p.month, 0),
            '-',
            COALESCE(p.year, 0)
        )
    ) as id,
    p.student_id,
    p.student_name,
    p.student_code,
    p.class_id,
    p.class_name,
    p.class_code,
    COALESCE(p.subject, '') as subject,
    COALESCE(p.month, 0) as month,
    COALESCE(p.year, 0) as year,
    COALESCE(p.total_sessions, 0)::INTEGER as total_sessions,
    -- Lấy price_per_session từ hoc_phi_rieng trong lop_hoc_hoc_sinh, fallback về giá trị trong bảng cũ
    COALESCE(
        lhhs.hoc_phi_rieng,
        p.price_per_session,
        0
    )::NUMERIC(12, 2) as price_per_session,
    COALESCE(p.total_amount, 0)::NUMERIC(12, 2) as total_amount,
    COALESCE(p.discount, 0)::NUMERIC(12, 2) as discount,
    COALESCE(p.final_amount, 0)::NUMERIC(12, 2) as final_amount,
    COALESCE(p.status, 'unpaid') as status,
    COALESCE(
        CASE 
            WHEN p.sessions IS NULL THEN '[]'::JSONB
            WHEN jsonb_typeof(p.sessions::JSONB) = 'array' THEN p.sessions::JSONB
            ELSE '[]'::JSONB
        END,
        '[]'::JSONB
    ) as sessions,
    p.invoice_image,
    COALESCE(p.debt, 0)::NUMERIC(12, 2) as debt,
    p.paid_at::TIMESTAMP WITH TIME ZONE as paid_at,
    NULL::TEXT as notes, -- Cột notes không có trong bảng cũ, set NULL
    '{}'::JSONB as metadata, -- Cột metadata không có trong bảng cũ, set empty object
    COALESCE(p.created_at, NOW()) as created_at,
    COALESCE(p.updated_at, NOW()) as updated_at
FROM public.phieu_thu_hoc_phi p
LEFT JOIN public.lop_hoc_hoc_sinh lhhs 
    ON lhhs.student_id = p.student_id 
    AND lhhs.class_id = p.class_id 
    AND lhhs.status = 'active'
WHERE NOT EXISTS (
    -- Chỉ insert nếu chưa tồn tại trong bảng mới
    SELECT 1 
    FROM public.phieu_thu_hoc_phi_chi_tiet c
    WHERE c.student_id = p.student_id
      AND c.class_id = p.class_id
      AND c.month = COALESCE(p.month, 0)
      AND c.year = COALESCE(p.year, 0)
)
ON CONFLICT (student_id, class_id, month, year) DO NOTHING;

-- BƯỚC 4: Hiển thị kết quả migration
SELECT 
    'Migration completed' as status,
    COUNT(*) as total_records_migrated
FROM public.phieu_thu_hoc_phi_chi_tiet;

-- BƯỚC 5: So sánh số lượng record giữa 2 bảng
SELECT 
    'phieu_thu_hoc_phi' as table_name,
    COUNT(*) as record_count
FROM public.phieu_thu_hoc_phi
UNION ALL
SELECT 
    'phieu_thu_hoc_phi_chi_tiet' as table_name,
    COUNT(*) as record_count
FROM public.phieu_thu_hoc_phi_chi_tiet;
