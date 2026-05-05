# 📊 DATABASE SCHEMA - Trí Tuệ 8+

## 📋 Tổng quan
Dự án sử dụng **Supabase (PostgreSQL)** làm database chính. Tất cả bảng lưu trữ dữ liệu học sinh, lớp học, học phí, điểm danh, etc.

**Database URL:** `https://mldlabfnewfgygpadfka.supabase.co`

---

## 📑 DANH SÁCH CÁC BẢNG

### 1️⃣ **`hoc_sinh`** (Học sinh)
**Mô tả:** Lưu trữ thông tin học sinh

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | TEXT | ID học sinh (Firebase ID) |
| `ho_va_ten` | TEXT | Họ và tên |
| `ma_hoc_sinh` | TEXT | Mã học sinh |
| `ngay_sinh` | DATE | Ngày sinh |
| `gioi_tinh` | TEXT | Giới tính (Nam/Nữ) |
| `so_dien_thoai` | TEXT | Số điện thoại |
| `sdt_phu_huynh` | TEXT | SĐT phụ huynh |
| `ho_ten_phu_huynh` | TEXT | Tên phụ huynh |
| `dia_chi` | TEXT | Địa chỉ |
| `truong` | TEXT | Trường |
| `khoi` | TEXT | Khối học (Lớp 8, 9, etc) |
| `email` | TEXT | Email |
| `username` | TEXT | Username portal |
| `password` | TEXT | Password (hash) |
| `diem_so` | NUMERIC | Điểm số |
| `trang_thai` | TEXT | Trạng thái (active/inactive/graduated) |
| `so_gio_da_gia_han` | NUMERIC | Số giờ đã gia hạn |
| `so_gio_con_lai` | NUMERIC | Số giờ còn lại |
| `so_gio_da_hoc` | NUMERIC | Số giờ đã học |
| `ghi_chu` | TEXT | Ghi chú |
| `metadata` | JSONB | Dữ liệu bổ sung |
| `created_at` | TIMESTAMP | Thời gian tạo |
| `updated_at` | TIMESTAMP | Thời gian cập nhật |

**Index:**
- `idx_hoc_sinh_ma_hoc_sinh` - Mã học sinh
- `idx_hoc_sinh_ho_va_ten` - Tên học sinh
- `idx_hoc_sinh_trang_thai` - Trạng thái

---

### 2️⃣ **`lop_hoc`** (Lớp học)
**Mô tả:** Lưu trữ thông tin lớp học, đặc biệt là học phí mỗi buổi

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | TEXT | ID lớp |
| `ten_lop` | TEXT | Tên lớp |
| `ma_lop` | TEXT | Mã lớp |
| `mon_hoc` | TEXT | Môn học |
| `khoi` | TEXT | Khối |
| `giao_vien_chu_nhiem` | TEXT | Giáo viên chủ nhiệm |
| `teacher_id` | TEXT | ID giáo viên |
| `phong_hoc` | TEXT | Phòng học |
| `luong_gv` | NUMERIC | **Lương giáo viên** |
| `hoc_phi_moi_buoi` | NUMERIC | **Học phí mỗi buổi** ⭐ |
| `ghi_chu` | TEXT | Ghi chú |
| `trang_thai` | TEXT | Trạng thái (active/inactive) |
| `ngay_tao` | TIMESTAMP | Ngày tạo |
| `nguoi_tao` | TEXT | Người tạo |
| `lich_hoc` | JSONB | Lịch học (JSON array) |
| `hoc_sinh` | JSONB | Tên học sinh |
| `student_ids` | JSONB | ID học sinh |
| `student_enrollments` | JSONB | Ngày đăng ký từng HS |
| `ngay_bat_dau` | DATE | Ngày bắt đầu |
| `ngay_ket_thuc` | DATE | Ngày kết thúc |
| `created_at` | TIMESTAMP | Thời gian tạo |
| `updated_at` | TIMESTAMP | Thời gian cập nhật |

**Index:**
- `idx_lop_hoc_ma_lop` - Mã lớp
- `idx_lop_hoc_mon_hoc` - Môn học
- `idx_lop_hoc_teacher_id` - ID giáo viên

---

### 3️⃣ **`phieu_thu_hoc_phi_chi_tiet`** (Phiếu thu học phí chi tiết)
**Mô tả:** Lưu học phí của từng môn học cho mỗi học sinh trong tháng

**Quan trọng:** Một học sinh có thể có nhiều môn học trong cùng 1 tháng

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | TEXT | ID (Format: {studentId}-{classId}-{month}-{year}) |
| `student_id` | TEXT | ID học sinh ⭐ |
| `student_name` | TEXT | Tên học sinh |
| `student_code` | TEXT | Mã học sinh |
| `class_id` | TEXT | ID lớp học ⭐ |
| `class_name` | TEXT | Tên lớp |
| `class_code` | TEXT | Mã lớp |
| `subject` | TEXT | Môn học |
| `month` | INTEGER | Tháng (1-12) ⭐ |
| `year` | INTEGER | Năm ⭐ |
| `total_sessions` | INTEGER | Tổng số buổi học |
| `price_per_session` | NUMERIC | Đơn giá mỗi buổi ⭐ |
| `total_amount` | NUMERIC | Tổng tiền (trước giảm giá) |
| `discount` | NUMERIC | Số tiền giảm giá |
| `final_amount` | NUMERIC | Thành tiền (sau giảm giá) |
| `status` | TEXT | Trạng thái (paid/unpaid) |
| `sessions` | JSONB | Danh sách buổi học |
| `invoice_image` | TEXT | Base64 ảnh phiếu thu |
| `debt` | NUMERIC | Công nợ từ tháng trước |
| `paid_at` | TIMESTAMP | Thời gian thanh toán |
| `notes` | TEXT | Ghi chú |
| `metadata` | JSONB | Dữ liệu bổ sung |
| `created_at` | TIMESTAMP | Thời gian tạo |
| `updated_at` | TIMESTAMP | Thời gian cập nhật |

**Constraint:**
- `UNIQUE(student_id, class_id, month, year)` - Mỗi môn học chỉ có 1 phiếu/tháng

**Index:**
- `idx_phieu_thu_hoc_phi_chi_tiet_student_id`
- `idx_phieu_thu_hoc_phi_chi_tiet_class_id`
- `idx_phieu_thu_hoc_phi_chi_tiet_month_year`
- `idx_phieu_thu_hoc_phi_chi_tiet_status`

---

### 4️⃣ **`lop_hoc_hoc_sinh`** (Chi tiết danh sách HS trong lớp)
**Mô tả:** Mối quan hệ giữa học sinh và lớp học, cho phép query nhanh

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | TEXT | ID (UUID) |
| `class_id` | TEXT | ID lớp học ⭐ |
| `student_id` | TEXT | ID học sinh ⭐ |
| `student_name` | TEXT | Tên học sinh |
| `student_code` | TEXT | Mã học sinh |
| `hoc_phi_rieng` | NUMERIC | Học phí riêng (override) |
| `enrollment_date` | DATE | Ngày đăng ký |
| `status` | TEXT | Trạng thái (active/inactive/dropped) |
| `notes` | TEXT | Ghi chú |
| `created_at` | TIMESTAMP | Thời gian tạo |
| `updated_at` | TIMESTAMP | Thời gian cập nhật |

**Constraint:**
- `UNIQUE(class_id, student_id, status)` - Mỗi HS chỉ có 1 enrollment active/lớp

**Index:**
- `idx_lop_hoc_hoc_sinh_class_id`
- `idx_lop_hoc_hoc_sinh_student_id`
- `idx_lop_hoc_hoc_sinh_class_status`

---

### 5️⃣ **`gia_han`** (Gia hạn - Extension History)
**Mô tả:** Lịch sử gia hạn giờ học cho học sinh

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | TEXT | ID (UUID) |
| `student_id` | TEXT | ID học sinh ⭐ |
| `gio_da_hoc` | TEXT | Giờ đã học |
| `gio_con_lai` | TEXT | Giờ còn lại |
| `gio_nhap_them` | NUMERIC | Giờ nhập thêm (có thể âm) |
| `nguoi_nhap` | TEXT | Người nhập |
| `ngay_nhap` | DATE | Ngày nhập |
| `gio_nhap` | TIME | Giờ nhập |
| `adjustment_type` | TEXT | Loại điều chỉnh |
| `old_total` | NUMERIC | Tổng cũ |
| `new_total` | NUMERIC | Tổng mới |
| `note` | TEXT | Lý do |
| `metadata` | JSONB | Dữ liệu bổ sung |
| `created_at` | TIMESTAMP | Thời gian tạo |

**Index:**
- `idx_gia_han_student_id`
- `idx_gia_han_timestamp`

---

### 6️⃣ **`lich_su_sao_thuong`** (Stars History)
**Mô tả:** Lịch sử thay đổi sao thưởng cho học sinh

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | TEXT | ID (UUID) |
| `student_id` | TEXT | ID học sinh ⭐ |
| `thay_doi` | NUMERIC | Số sao thay đổi |
| `so_sao_truoc` | NUMERIC | Số sao trước |
| `so_sao_sau` | NUMERIC | Số sao sau |
| `ly_do` | TEXT | Lý do thay đổi |
| `nguoi_chinh_sua` | TEXT | Người thay đổi |
| `ngay_chinh_sua` | DATE | Ngày thay đổi |
| `gio_chinh_sua` | TIME | Giờ thay đổi |
| `loai_thay_doi` | TEXT | Loại thay đổi |
| `metadata` | JSONB | Dữ liệu bổ sung |
| `created_at` | TIMESTAMP | Thời gian tạo |

**Index:**
- `idx_lich_su_sao_thuong_student_id`
- `idx_lich_su_sao_thuong_timestamp`

---

### 7️⃣ **`diem_danh_sessions`** (Attendance Sessions)
**Mô tả:** Các buổi học / sessions điểm danh

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | TEXT | ID session |
| `class_id` | TEXT | ID lớp |
| `ngay` | DATE | Ngày học |
| `gio_bat_dau` | TIME | Giờ bắt đầu |
| `gio_ket_thuc` | TIME | Giờ kết thúc |
| `teacher_id` | TEXT | ID giáo viên |
| `trang_thai` | TEXT | Trạng thái (not_started/in_progress/completed) |
| (more fields) | ... | ... |

---

### 8️⃣ **`thoi_khoa_bieu`** (Timetable)
**Mô tả:** Lịch học tùy chỉnh

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | TEXT | ID |
| `class_id` | TEXT | ID lớp |
| `ma_lop` | TEXT | Mã lớp |
| `ten_lop` | TEXT | Tên lớp |
| `ngay` | DATE | Ngày học |
| `thu` | INTEGER | Thứ (2-8) |
| `gio_bat_dau` | TEXT | Giờ bắt đầu |
| `gio_ket_thuc` | TEXT | Giờ kết thúc |
| `phong_hoc` | TEXT | Phòng học |
| `ghi_chu` | TEXT | Ghi chú |
| `thay_the_ngay` | DATE | Ngày thay thế |
| `teacher_id` | TEXT | ID giáo viên |
| `giao_vien` | TEXT | Tên giáo viên |
| `created_at` | TIMESTAMP | Thời gian tạo |
| `updated_at` | TIMESTAMP | Thời gian cập nhật |

**Index:**
- `idx_thoi_khoa_bieu_class_id`
- `idx_thoi_khoa_bieu_ngay`

---

## 🔗 QUAN HỆ GIỮA CÁC BẢNG

```
hoc_sinh (1)
    ├── (1-N) lop_hoc_hoc_sinh (N-M junction table)
    │   └── (N) lop_hoc
    ├── (1-N) phieu_thu_hoc_phi_chi_tiet
    ├── (1-N) gia_han
    └── (1-N) lich_su_sao_thuong

lop_hoc (1)
    ├── (1-N) lop_hoc_hoc_sinh
    ├── (1-N) phieu_thu_hoc_phi_chi_tiet
    ├── (1-N) diem_danh_sessions
    └── (1-N) thoi_khoa_bieu
```

---

## 💰 TÍNH TOÁN HỌC PHÍ

**Công thức tính học phí cho 1 học sinh - 1 môn - 1 tháng:**

```
total_amount = total_sessions × price_per_session
final_amount = total_amount - discount
```

**Ví dụ:**
- Tổng buổi học: 4 buổi
- Đơn giá: 500.000 đ/buổi
- Giảm giá: 100.000 đ
- **Tổng tiền = 4 × 500.000 = 2.000.000 đ**
- **Thành tiền = 2.000.000 - 100.000 = 1.900.000 đ**

---

## 🔐 SECURITY

- RLS (Row Level Security) được **DISABLE** để cho phép toàn bộ truy cập
- Service key dùng cho admin operations
- Anon key dùng cho client-side operations

---

## 📝 NOTES

⭐ = Cột quan trọng cho business logic
- Học phí được tính dựa vào `price_per_session` từ bảng `lop_hoc`
- Một học sinh có thể học nhiều lớp (môn học khác nhau) trong 1 tháng
- Công nợ được lưu trong `phieu_thu_hoc_phi_chi_tiet.debt`

