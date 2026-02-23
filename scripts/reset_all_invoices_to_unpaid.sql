-- ============================================
-- RESET TẤT CẢ PHIẾU THU VỀ TRẠNG THÁI CHƯA ĐÓNG
-- CẢNH BÁO: Script này sẽ set TẤT CẢ phiếu thu có status = 'paid' về 'unpaid'
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

-- BƯỚC 2: Kiểm tra số lượng phiếu đã thanh toán trước khi reset
SELECT 
    COUNT(*) as so_phieu_da_thanh_toan,
    SUM(final_amount) as tong_tien_da_thu
FROM phieu_thu_hoc_phi
WHERE status = 'paid';

-- BƯỚC 3: Reset tất cả phiếu thu về trạng thái chưa đóng
UPDATE phieu_thu_hoc_phi
SET 
    status = 'unpaid',
    paid_at = NULL,
    updated_at = NOW()
WHERE status = 'paid';

-- BƯỚC 4: Kiểm tra kết quả sau khi reset
SELECT 
    COUNT(*) as tong_so_phieu,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as so_phieu_da_thanh_toan,
    COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as so_phieu_chua_thanh_toan
FROM phieu_thu_hoc_phi;

-- ============================================
-- HOÀN TẤT
-- ============================================
-- Tất cả các phiếu thu đã được reset về trạng thái 'unpaid'
-- paid_at đã được set về NULL
-- updated_at đã được cập nhật tự động
