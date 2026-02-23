-- ============================================
-- XÓA TẤT CẢ DỮ LIỆU TRONG BẢNG PHIẾU THU HỌC PHÍ
-- CẨN THẬN: Lệnh này sẽ xóa TOÀN BỘ dữ liệu!
-- ============================================

-- Xóa tất cả dữ liệu trong bảng phieu_thu_hoc_phi
DELETE FROM phieu_thu_hoc_phi;

-- Kiểm tra số lượng bản ghi còn lại (sẽ trả về 0 nếu xóa thành công)
SELECT COUNT(*) as remaining_records FROM phieu_thu_hoc_phi;

-- ============================================
-- HOÀN TẤT
-- ============================================
-- Tất cả dữ liệu đã được xóa khỏi bảng phieu_thu_hoc_phi
-- Bảng vẫn tồn tại nhưng không còn dữ liệu nào
