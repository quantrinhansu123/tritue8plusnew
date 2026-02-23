-- Tạo bảng gia_han (Gia hạn - Extension History) trong Supabase
-- Bảng này lưu trữ lịch sử gia hạn giờ học cho học sinh

CREATE TABLE IF NOT EXISTS public.gia_han (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    student_id TEXT NOT NULL, -- ID học sinh (foreign key to hoc_sinh)
    gio_da_hoc TEXT, -- "Giờ đã học" (ví dụ: "10h 30p")
    gio_con_lai TEXT, -- "Giờ còn lại"
    gio_nhap_them NUMERIC, -- "Giờ nhập thêm" (có thể âm để trừ)
    nguoi_nhap TEXT, -- "Người nhập"
    ngay_nhap DATE, -- "Ngày nhập"
    gio_nhap TIME, -- "Giờ nhập"
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Timestamp
    adjustment_type TEXT, -- "Adjustment Type" (nếu có)
    old_total NUMERIC, -- "Old Total" (nếu có)
    new_total NUMERIC, -- "New Total" (nếu có)
    note TEXT, -- "Note" hoặc "Lý do"
    metadata JSONB, -- Lưu các trường bổ sung khác
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo index cho các cột thường dùng để tìm kiếm
CREATE INDEX IF NOT EXISTS idx_gia_han_student_id ON public.gia_han(student_id);
CREATE INDEX IF NOT EXISTS idx_gia_han_ngay_nhap ON public.gia_han(ngay_nhap);
CREATE INDEX IF NOT EXISTS idx_gia_han_timestamp ON public.gia_han(timestamp);

-- Thêm comment cho bảng
COMMENT ON TABLE public.gia_han IS 'Bảng lưu trữ lịch sử gia hạn giờ học cho học sinh';
COMMENT ON COLUMN public.gia_han.student_id IS 'ID học sinh - tham chiếu đến bảng hoc_sinh';
COMMENT ON COLUMN public.gia_han.gio_nhap_them IS 'Số giờ thêm vào (có thể âm để trừ giờ)';
