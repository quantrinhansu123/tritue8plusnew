-- Script để xóa các views không còn sử dụng

-- Xóa các views liên quan đến phiếu thu học phí
DROP VIEW IF EXISTS v_phieu_thu_hoc_phi_chi_tiet CASCADE;
DROP VIEW IF EXISTS v_phieu_thu_hoc_phi_tong_hop CASCADE;
DROP VIEW IF EXISTS vw_phieu_thu_tong_hop CASCADE;

-- Xóa view liên quan đến lớp học và học sinh
DROP VIEW IF EXISTS v_lop_hoc_hoc_sinh CASCADE;

-- Thông báo hoàn thành
DO $$
BEGIN
    RAISE NOTICE '✅ Đã xóa các views:';
    RAISE NOTICE '   - v_phieu_thu_hoc_phi_chi_tiet';
    RAISE NOTICE '   - v_phieu_thu_hoc_phi_tong_hop';
    RAISE NOTICE '   - vw_phieu_thu_tong_hop';
    RAISE NOTICE '   - v_lop_hoc_hoc_sinh';
END $$;
