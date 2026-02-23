-- ============================================
-- BẬT REAL-TIME REPLICATION CHO BẢNG PHIẾU THU
-- Cần thiết để real-time listener hoạt động
-- ============================================

-- Enable real-time replication for phieu_thu_hoc_phi table
ALTER PUBLICATION supabase_realtime ADD TABLE phieu_thu_hoc_phi;

-- Kiểm tra xem đã enable chưa
SELECT 
    schemaname,
    tablename,
    pubname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'phieu_thu_hoc_phi';

-- ============================================
-- HOÀN TẤT
-- ============================================
-- Real-time replication đã được bật cho bảng phieu_thu_hoc_phi
-- Bây giờ real-time listener sẽ hoạt động và tự động cập nhật UI
