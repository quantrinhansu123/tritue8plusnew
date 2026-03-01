-- Tạo bảng thoi_khoa_bieu cho lịch học tùy chỉnh
-- Chạy trong Supabase SQL Editor trước khi migrate Thời_khoá_biểu

CREATE TABLE IF NOT EXISTS thoi_khoa_bieu (
  id TEXT PRIMARY KEY,
  class_id TEXT,
  ma_lop TEXT,
  ten_lop TEXT,
  ngay DATE,
  thu INTEGER,
  gio_bat_dau TEXT,
  gio_ket_thuc TEXT,
  phong_hoc TEXT,
  ghi_chu TEXT,
  thay_the_ngay DATE,
  thay_the_thu INTEGER,
  teacher_id TEXT,
  giao_vien TEXT,
  timestamp TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thoi_khoa_bieu_class_id ON thoi_khoa_bieu(class_id);
CREATE INDEX IF NOT EXISTS idx_thoi_khoa_bieu_ngay ON thoi_khoa_bieu(ngay);

ALTER TABLE thoi_khoa_bieu ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for thoi_khoa_bieu" ON thoi_khoa_bieu;
CREATE POLICY "Allow all for thoi_khoa_bieu" ON thoi_khoa_bieu
  FOR ALL USING (true) WITH CHECK (true);
