    -- ============================================
    -- TẠO BẢNG PHIẾU THU HỌC PHÍ CHI TIẾT
    -- Bảng này lưu học phí của từng môn học cho mỗi học sinh trong tháng
    -- Một học sinh có thể có nhiều môn học trong cùng 1 tháng
    -- ============================================

    -- Tạo bảng phieu_thu_hoc_phi_chi_tiet
    CREATE TABLE IF NOT EXISTS public.phieu_thu_hoc_phi_chi_tiet (
        id TEXT PRIMARY KEY, -- Format: {studentId}-{classId}-{month}-{year}
        student_id TEXT NOT NULL, -- ID của học sinh
        student_name TEXT, -- Tên học sinh (denormalized)
        student_code TEXT, -- Mã học sinh (denormalized)
        class_id TEXT NOT NULL, -- ID của lớp học
        class_name TEXT, -- Tên lớp học (denormalized)
        class_code TEXT, -- Mã lớp học (denormalized)
        subject TEXT, -- Môn học
        month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12), -- Tháng (1-12)
        year INTEGER NOT NULL, -- Năm
        total_sessions INTEGER DEFAULT 0, -- Tổng số buổi học
        price_per_session NUMERIC(12, 2) DEFAULT 0, -- Đơn giá mỗi buổi học
        total_amount NUMERIC(12, 2) DEFAULT 0, -- Tổng tiền (trước giảm giá)
        discount NUMERIC(12, 2) DEFAULT 0, -- Số tiền giảm giá
        final_amount NUMERIC(12, 2) DEFAULT 0, -- Thành tiền (sau giảm giá)
        status TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')), -- Trạng thái thanh toán
        sessions JSONB DEFAULT '[]'::JSONB, -- Danh sách các buổi học (JSON array)
        invoice_image TEXT, -- Base64 image data của phiếu thu
        debt NUMERIC(12, 2) DEFAULT 0, -- Công nợ từ các tháng trước
        paid_at TIMESTAMP WITH TIME ZONE, -- Thời điểm thanh toán
        notes TEXT, -- Ghi chú
        metadata JSONB DEFAULT '{}'::JSONB, -- Metadata bổ sung
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Đảm bảo mỗi học sinh chỉ có 1 invoice cho 1 môn học trong 1 tháng
        CONSTRAINT unique_student_class_month_year UNIQUE (student_id, class_id, month, year)
    );

    -- Tạo index cho các cột thường dùng để tìm kiếm
    CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_chi_tiet_student_id ON public.phieu_thu_hoc_phi_chi_tiet(student_id);
    CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_chi_tiet_student_code ON public.phieu_thu_hoc_phi_chi_tiet(student_code);
    CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_chi_tiet_class_id ON public.phieu_thu_hoc_phi_chi_tiet(class_id);
    CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_chi_tiet_month_year ON public.phieu_thu_hoc_phi_chi_tiet(month, year);
    CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_chi_tiet_status ON public.phieu_thu_hoc_phi_chi_tiet(status);
    CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_chi_tiet_student_month_year ON public.phieu_thu_hoc_phi_chi_tiet(student_id, month, year);

    -- Composite index để query tất cả các môn học của 1 học sinh trong 1 tháng
    CREATE INDEX IF NOT EXISTS idx_phieu_thu_hoc_phi_chi_tiet_student_month_year_status 
        ON public.phieu_thu_hoc_phi_chi_tiet(student_id, month, year, status);

    -- Tạo trigger để tự động cập nhật updated_at
    CREATE TRIGGER update_phieu_thu_hoc_phi_chi_tiet_updated_at 
        BEFORE UPDATE ON public.phieu_thu_hoc_phi_chi_tiet
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    -- Tạo view để tổng hợp tất cả các môn học của 1 học sinh trong 1 tháng
    CREATE OR REPLACE VIEW public.v_phieu_thu_hoc_phi_tong_hop AS
    SELECT 
        student_id,
        student_name,
        student_code,
        month,
        year,
        COUNT(*) as so_mon_hoc, -- Số môn học
        SUM(total_sessions) as tong_so_buoi_hoc, -- Tổng số buổi học
        SUM(total_amount) as tong_tien, -- Tổng tiền (trước giảm giá)
        SUM(discount) as tong_giam_gia, -- Tổng giảm giá
        SUM(final_amount) as tong_thanh_tien, -- Tổng thành tiền (sau giảm giá)
        SUM(CASE WHEN status = 'paid' THEN final_amount ELSE 0 END) as tong_da_thanh_toan,
        SUM(CASE WHEN status = 'unpaid' THEN final_amount ELSE 0 END) as tong_chua_thanh_toan,
        -- Trạng thái: paid nếu tất cả đã thanh toán, unpaid nếu còn ít nhất 1 môn chưa thanh toán
        CASE 
            WHEN COUNT(*) FILTER (WHERE status = 'unpaid') = 0 THEN 'paid'
            ELSE 'unpaid'
        END as status,
        MAX(paid_at) as paid_at, -- Thời điểm thanh toán cuối cùng
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at
    FROM public.phieu_thu_hoc_phi_chi_tiet
    GROUP BY student_id, student_name, student_code, month, year;

    -- Tạo view để xem chi tiết từng môn học của học sinh trong tháng
    CREATE OR REPLACE VIEW public.v_phieu_thu_hoc_phi_chi_tiet AS
    SELECT 
        id,
        student_id,
        student_name,
        student_code,
        class_id,
        class_name,
        class_code,
        subject,
        month,
        year,
        total_sessions,
        price_per_session,
        total_amount,
        discount,
        final_amount,
        status,
        invoice_image,
        debt,
        paid_at,
        notes,
        created_at,
        updated_at
    FROM public.phieu_thu_hoc_phi_chi_tiet
    ORDER BY student_id, month, year, class_name;

    -- Tắt Row Level Security (RLS) để đảm bảo có thể truy cập dữ liệu
    ALTER TABLE public.phieu_thu_hoc_phi_chi_tiet DISABLE ROW LEVEL SECURITY;

    -- Bật Realtime cho bảng
    ALTER PUBLICATION supabase_realtime ADD TABLE public.phieu_thu_hoc_phi_chi_tiet;

    -- Thêm comment cho bảng
    COMMENT ON TABLE public.phieu_thu_hoc_phi_chi_tiet IS 'Bảng chi tiết phiếu thu học phí - lưu học phí của từng môn học cho mỗi học sinh trong tháng';
    COMMENT ON VIEW public.v_phieu_thu_hoc_phi_tong_hop IS 'View tổng hợp tất cả các môn học của 1 học sinh trong 1 tháng';
    COMMENT ON VIEW public.v_phieu_thu_hoc_phi_chi_tiet IS 'View chi tiết từng môn học của học sinh trong tháng';
