-- ============================================
-- RESET PHIẾU THU VỀ TRẠNG THÁI CHƯA ĐÓNG THEO THÁNG/NĂM
-- Script này cho phép reset phiếu thu theo tháng/năm cụ thể
-- ============================================

-- BƯỚC 1: Kiểm tra bảng có tồn tại không
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'phieu_thu_hoc_phi'
    ) THEN
        RAISE EXCEPTION 'Bảng phieu_thu_hoc_phi không tồn tại! Vui lòng chạy script tạo bảng trước (create_table_phieu_thu_hoc_phi.sql)';
    END IF;
END $$;

-- THAY ĐỔI CÁC GIÁ TRỊ SAU THEO NHU CẦU:
-- @target_year: Năm cần reset (ví dụ: 2024)
-- @target_month: Tháng cần reset (1-12, ví dụ: 12 cho tháng 12)

-- Ví dụ: Reset tất cả phiếu thu tháng 12/2024 về chưa đóng
-- SET @target_year = 2024;
-- SET @target_month = 12;

-- Hoặc reset tất cả các tháng của một năm:
-- SET @target_year = 2024;
-- SET @target_month = NULL; -- NULL = tất cả các tháng

-- ============================================
-- PHIÊN BẢN 1: Reset theo tháng/năm cụ thể
-- ============================================

-- Kiểm tra số lượng phiếu sẽ bị reset
SELECT 
    year,
    month,
    COUNT(*) as so_phieu_da_thanh_toan,
    SUM(final_amount) as tong_tien_da_thu
FROM phieu_thu_hoc_phi
WHERE status = 'paid'
  AND year = 2024  -- THAY ĐỔI NĂM Ở ĐÂY
  AND month = 12   -- THAY ĐỔI THÁNG Ở ĐÂY (1-12)
GROUP BY year, month;

-- Reset phiếu thu theo tháng/năm
UPDATE phieu_thu_hoc_phi
SET 
    status = 'unpaid',
    paid_at = NULL,
    updated_at = NOW()
WHERE status = 'paid'
  AND year = 2024  -- THAY ĐỔI NĂM Ở ĐÂY
  AND month = 12;  -- THAY ĐỔI THÁNG Ở ĐÂY (1-12)

-- ============================================
-- PHIÊN BẢN 2: Reset tất cả các tháng của một năm
-- ============================================

-- Kiểm tra số lượng phiếu sẽ bị reset
-- SELECT 
--     year,
--     month,
--     COUNT(*) as so_phieu_da_thanh_toan,
--     SUM(final_amount) as tong_tien_da_thu
-- FROM phieu_thu_hoc_phi
-- WHERE status = 'paid'
--   AND year = 2024  -- THAY ĐỔI NĂM Ở ĐÂY
-- GROUP BY year, month;

-- Reset tất cả phiếu thu của một năm
-- UPDATE phieu_thu_hoc_phi
-- SET 
--     status = 'unpaid',
--     paid_at = NULL,
--     updated_at = NOW()
-- WHERE status = 'paid'
--   AND year = 2024;  -- THAY ĐỔI NĂM Ở ĐÂY

-- ============================================
-- PHIÊN BẢN 3: Reset theo khoảng thời gian
-- ============================================

-- Reset phiếu thu từ tháng X năm Y đến tháng Z năm Y
-- UPDATE phieu_thu_hoc_phi
-- SET 
--     status = 'unpaid',
--     paid_at = NULL,
--     updated_at = NOW()
-- WHERE status = 'paid'
--   AND year = 2024  -- THAY ĐỔI NĂM Ở ĐÂY
--   AND month >= 10  -- Tháng bắt đầu (1-12)
--   AND month <= 12; -- Tháng kết thúc (1-12)

-- ============================================
-- KIỂM TRA KẾT QUẢ
-- ============================================

-- Xem tổng hợp sau khi reset
SELECT 
    year,
    month,
    COUNT(*) as tong_so_phieu,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as so_phieu_da_thanh_toan,
    COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as so_phieu_chua_thanh_toan
FROM phieu_thu_hoc_phi
WHERE year = 2024  -- THAY ĐỔI NĂM Ở ĐÂY
  AND month = 12   -- THAY ĐỔI THÁNG Ở ĐÂY (hoặc comment dòng này để xem tất cả)
GROUP BY year, month
ORDER BY year DESC, month DESC;

-- ============================================
-- HOÀN TẤT
-- ============================================
-- Các phiếu thu đã được reset về trạng thái 'unpaid'
-- paid_at đã được set về NULL
-- updated_at đã được cập nhật tự động
