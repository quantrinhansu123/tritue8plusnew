-- Tạo bảng hoc_sinh (Học sinh) trong Supabase
-- Bảng này lưu trữ thông tin học sinh, migrate từ Firebase "Danh_sách_học_sinh"

CREATE TABLE IF NOT EXISTS public.hoc_sinh (
    id TEXT PRIMARY KEY, -- ID từ Firebase (giữ nguyên để mapping)
    ho_va_ten TEXT NOT NULL, -- "Họ và tên"
    ma_hoc_sinh TEXT, -- "Mã học sinh"
    ngay_sinh DATE, -- "Ngày sinh"
    gioi_tinh TEXT, -- "Giới tính" (Nam, Nữ)
    so_dien_thoai TEXT, -- "Số điện thoại"
    sdt_phu_huynh TEXT, -- "SĐT phụ huynh"
    ho_ten_phu_huynh TEXT, -- "Họ tên phụ huynh" hoặc "Phụ huynh"
    dia_chi TEXT, -- "Địa chỉ"
    truong TEXT, -- "Trường"
    khoi TEXT, -- "Khối"
    email TEXT, -- "Email"
    username TEXT, -- "Username" (cho portal)
    password TEXT, -- "Password" (cho portal - nên hash)
    diem_so NUMERIC, -- "Điểm số"
    trang_thai TEXT DEFAULT 'active', -- "Trạng thái" (active, inactive, graduated)
    so_gio_da_gia_han NUMERIC DEFAULT 0, -- "Số giờ đã gia hạn"
    so_gio_con_lai NUMERIC DEFAULT 0, -- "Số giờ còn lại"
    so_gio_da_hoc NUMERIC DEFAULT 0, -- "Số giờ đã học"
    ghi_chu TEXT, -- "Ghi chú" hoặc các trường khác
    metadata JSONB, -- Lưu các trường bổ sung khác từ Firebase
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo index cho các cột thường dùng để tìm kiếm
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_ma_hoc_sinh ON public.hoc_sinh(ma_hoc_sinh);
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_ho_va_ten ON public.hoc_sinh(ho_va_ten);
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_so_dien_thoai ON public.hoc_sinh(so_dien_thoai);
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_sdt_phu_huynh ON public.hoc_sinh(sdt_phu_huynh);
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_trang_thai ON public.hoc_sinh(trang_thai);
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_khoi ON public.hoc_sinh(khoi);
CREATE INDEX IF NOT EXISTS idx_hoc_sinh_truong ON public.hoc_sinh(truong);

-- Tạo unique constraint cho mã học sinh (nếu có)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hoc_sinh_ma_hoc_sinh_unique 
ON public.hoc_sinh(ma_hoc_sinh) 
WHERE ma_hoc_sinh IS NOT NULL AND ma_hoc_sinh != '';

-- Tạo trigger để tự động cập nhật updated_at
CREATE TRIGGER update_hoc_sinh_updated_at 
    BEFORE UPDATE ON public.hoc_sinh
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Thêm comment cho bảng và các cột quan trọng
COMMENT ON TABLE public.hoc_sinh IS 'Bảng lưu trữ thông tin học sinh, migrate từ Firebase Danh_sách_học_sinh';
COMMENT ON COLUMN public.hoc_sinh.id IS 'ID từ Firebase (giữ nguyên để mapping)';
COMMENT ON COLUMN public.hoc_sinh.ho_va_ten IS 'Họ và tên học sinh';
COMMENT ON COLUMN public.hoc_sinh.ma_hoc_sinh IS 'Mã học sinh (unique nếu có)';
COMMENT ON COLUMN public.hoc_sinh.trang_thai IS 'Trạng thái: active (đang học), inactive (tạm nghỉ), graduated (đã tốt nghiệp)';
COMMENT ON COLUMN public.hoc_sinh.metadata IS 'Lưu các trường bổ sung khác từ Firebase dưới dạng JSON';
