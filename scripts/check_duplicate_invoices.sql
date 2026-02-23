-- Kiểm tra các records trùng lặp trong bảng phieu_thu_hoc_phi_chi_tiet
-- Dựa trên constraint unique_student_class_month_year

-- 1. Tìm các records trùng lặp
SELECT 
    student_id,
    student_name,
    class_id,
    class_name,
    month,
    year,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY created_at) as record_ids,
    array_agg(created_at ORDER BY created_at) as created_dates
FROM phieu_thu_hoc_phi_chi_tiet
GROUP BY student_id, class_id, month, year, student_name, class_name
HAVING COUNT(*) > 1
ORDER BY student_name, year, month, class_name;

-- 2. Kiểm tra cụ thể cho Hồng Anh tháng 2/2026
SELECT 
    id,
    student_id,
    student_name,
    student_code,
    class_id,
    class_name,
    class_code,
    subject,
    price_per_session,
    total_sessions,
    total_amount,
    month,
    year,
    created_at,
    updated_at
FROM phieu_thu_hoc_phi_chi_tiet
WHERE 
    (student_name ILIKE '%Hồng Anh%' OR student_name ILIKE '%Hong Anh%')
    AND year = 2026
    AND month = 2
ORDER BY class_name, created_at;

-- 3. Kiểm tra constraint hiện tại
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'phieu_thu_hoc_phi_chi_tiet'::regclass
    AND conname = 'unique_student_class_month_year';
