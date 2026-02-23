-- Script để kiểm tra dữ liệu trong bảng phieu_thu_hoc_phi_chi_tiet
-- Kiểm tra các trường quan trọng: class_name, class_code, price_per_session

-- 1. Kiểm tra tổng số records
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT student_id) as total_students,
    COUNT(DISTINCT class_id) as total_classes
FROM phieu_thu_hoc_phi_chi_tiet;

-- 2. Kiểm tra các trường bị NULL hoặc rỗng
SELECT 
    'class_name' as field_name,
    COUNT(*) as total_records,
    COUNT(class_name) as has_value,
    COUNT(*) - COUNT(class_name) as null_or_empty,
    COUNT(DISTINCT class_name) as unique_values
FROM phieu_thu_hoc_phi_chi_tiet
UNION ALL
SELECT 
    'class_code' as field_name,
    COUNT(*) as total_records,
    COUNT(class_code) as has_value,
    COUNT(*) - COUNT(class_code) as null_or_empty,
    COUNT(DISTINCT class_code) as unique_values
FROM phieu_thu_hoc_phi_chi_tiet
UNION ALL
SELECT 
    'price_per_session' as field_name,
    COUNT(*) as total_records,
    COUNT(price_per_session) as has_value,
    COUNT(*) - COUNT(price_per_session) as null_or_empty,
    COUNT(DISTINCT price_per_session) as unique_values
FROM phieu_thu_hoc_phi_chi_tiet
UNION ALL
SELECT 
    'subject' as field_name,
    COUNT(*) as total_records,
    COUNT(subject) as has_value,
    COUNT(*) - COUNT(subject) as null_or_empty,
    COUNT(DISTINCT subject) as unique_values
FROM phieu_thu_hoc_phi_chi_tiet;

-- 3. Xem chi tiết các records thiếu dữ liệu quan trọng
SELECT 
    id,
    student_id,
    student_name,
    class_id,
    class_name,
    class_code,
    subject,
    price_per_session,
    total_sessions,
    total_amount,
    month,
    year,
    CASE 
        WHEN class_name IS NULL OR class_name = '' THEN '❌ Thiếu class_name'
        WHEN class_code IS NULL OR class_code = '' THEN '❌ Thiếu class_code'
        WHEN price_per_session IS NULL OR price_per_session = 0 THEN '❌ Thiếu price_per_session'
        ELSE '✅ Đầy đủ'
    END as status
FROM phieu_thu_hoc_phi_chi_tiet
WHERE 
    class_name IS NULL OR class_name = '' OR
    class_code IS NULL OR class_code = '' OR
    price_per_session IS NULL OR price_per_session = 0
ORDER BY student_name, year, month
LIMIT 50;

-- 4. Xem mẫu dữ liệu đầy đủ (5 records đầu tiên)
SELECT 
    id,
    student_id,
    student_name,
    class_id,
    class_name,
    class_code,
    subject,
    price_per_session,
    total_sessions,
    total_amount,
    month,
    year
FROM phieu_thu_hoc_phi_chi_tiet
WHERE 
    class_name IS NOT NULL AND class_name != '' AND
    class_code IS NOT NULL AND class_code != '' AND
    price_per_session IS NOT NULL AND price_per_session > 0
ORDER BY student_name, year, month
LIMIT 5;

-- 5. Kiểm tra dữ liệu cho học sinh "Yến Vy" (HS003) - tháng 2/2026
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
    final_amount,
    month,
    year,
    status
FROM phieu_thu_hoc_phi_chi_tiet
WHERE 
    (student_name ILIKE '%Yến Vy%' OR student_code = 'HS003')
    AND year = 2026
    AND month = 2
ORDER BY class_name;

-- 6. So sánh với bảng lop_hoc để kiểm tra class_name và class_code
SELECT 
    p.id,
    p.student_name,
    p.class_id,
    p.class_name as phieu_class_name,
    p.class_code as phieu_class_code,
    l.ten_lop as lop_hoc_class_name,
    l.ma_lop as lop_hoc_class_code,
    CASE 
        WHEN p.class_name IS NULL OR p.class_name = '' THEN '❌ Thiếu'
        WHEN l.ten_lop IS NOT NULL AND p.class_name != l.ten_lop THEN '⚠️ Khác nhau'
        ELSE '✅ Khớp'
    END as class_name_status,
    CASE 
        WHEN p.class_code IS NULL OR p.class_code = '' THEN '❌ Thiếu'
        WHEN l.ma_lop IS NOT NULL AND p.class_code != l.ma_lop THEN '⚠️ Khác nhau'
        ELSE '✅ Khớp'
    END as class_code_status
FROM phieu_thu_hoc_phi_chi_tiet p
LEFT JOIN lop_hoc l ON p.class_id = l.id
WHERE p.class_id IS NOT NULL
LIMIT 20;
