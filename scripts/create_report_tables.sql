-- Tạo bảng cho báo cáo học tập
-- Chạy script này trong Supabase SQL Editor

-- 1. Bảng diem_danh_sessions (nếu chưa có)
CREATE TABLE IF NOT EXISTS diem_danh_sessions (
  id TEXT PRIMARY KEY,
  ma_lop TEXT,
  ten_lop TEXT,
  class_id TEXT,
  ngay DATE,
  gio_bat_dau TEXT,
  gio_ket_thuc TEXT,
  giao_vien TEXT,
  teacher_id TEXT,
  trang_thai TEXT,
  diem_danh JSONB, -- Array of attendance records
  thoi_gian_diem_danh TEXT,
  nguoi_diem_danh TEXT,
  thoi_gian_hoan_thanh TEXT,
  nguoi_hoan_thanh TEXT,
  noi_dung_buoi_hoc TEXT,
  tai_lieu_noi_dung JSONB,
  bai_tap JSONB,
  timestamp TEXT,
  hoc_phi_moi_buoi NUMERIC,
  luong_gv NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng diem_tu_nhap (Custom Scores)
CREATE TABLE IF NOT EXISTS diem_tu_nhap (
  id TEXT PRIMARY KEY, -- class_id
  class_id TEXT NOT NULL,
  columns JSONB DEFAULT '[]'::jsonb, -- Array of column names
  scores JSONB DEFAULT '[]'::jsonb, -- Array of student scores
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Đảm bảo bảng hoc_sinh đã có (thường đã có sẵn)
-- Nếu chưa có, tạo bảng hoc_sinh
CREATE TABLE IF NOT EXISTS hoc_sinh (
  id TEXT PRIMARY KEY,
  ho_va_ten TEXT NOT NULL,
  ma_hoc_sinh TEXT,
  ngay_sinh DATE,
  gioi_tinh TEXT,
  so_dien_thoai TEXT,
  sdt_phu_huynh TEXT,
  ho_ten_phu_huynh TEXT,
  dia_chi TEXT,
  truong TEXT,
  khoi TEXT,
  email TEXT,
  username TEXT,
  password TEXT,
  diem_so NUMERIC,
  trang_thai TEXT,
  so_gio_da_gia_han NUMERIC,
  so_gio_con_lai NUMERIC,
  so_gio_da_hoc NUMERIC,
  ghi_chu TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Đảm bảo bảng lop_hoc đã có (thường đã có sẵn)
-- Nếu chưa có, tạo bảng lop_hoc
CREATE TABLE IF NOT EXISTS lop_hoc (
  id TEXT PRIMARY KEY,
  ten_lop TEXT,
  ma_lop TEXT,
  mon_hoc TEXT,
  khoi TEXT,
  giao_vien_chu_nhiem TEXT,
  teacher_id TEXT,
  phong_hoc TEXT,
  luong_gv NUMERIC,
  hoc_phi_moi_buoi NUMERIC,
  ghi_chu TEXT,
  trang_thai TEXT,
  ngay_tao DATE,
  nguoi_tao TEXT,
  lich_hoc JSONB,
  hoc_sinh JSONB,
  student_ids JSONB,
  student_enrollments JSONB,
  ngay_bat_dau DATE,
  ngay_ket_thuc DATE,
  tai_lieu JSONB,
  dia_diem TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo indexes để tăng tốc query
CREATE INDEX IF NOT EXISTS idx_diem_danh_sessions_class_id ON diem_danh_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_diem_danh_sessions_ngay ON diem_danh_sessions(ngay);
CREATE INDEX IF NOT EXISTS idx_diem_tu_nhap_class_id ON diem_tu_nhap(class_id);
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_ma_hoc_sinh ON hoc_sinh(ma_hoc_sinh);
CREATE INDEX IF NOT EXISTS idx_lop_hoc_ma_lop ON lop_hoc(ma_lop);

-- Tắt RLS (Row Level Security) cho các bảng này (hoặc tạo policies nếu cần)
ALTER TABLE diem_danh_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diem_tu_nhap ENABLE ROW LEVEL SECURITY;

-- Tạo policies để cho phép đọc/ghi (hoặc tắt RLS nếu không cần)
-- Policy: Cho phép tất cả đọc/ghi (chỉ dùng trong development)
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all for diem_danh_sessions" ON diem_danh_sessions;
DROP POLICY IF EXISTS "Allow all for diem_tu_nhap" ON diem_tu_nhap;

-- Create policies
CREATE POLICY "Allow all for diem_danh_sessions" ON diem_danh_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for diem_tu_nhap" ON diem_tu_nhap
  FOR ALL USING (true) WITH CHECK (true);
