# Các cột được cập nhật khi nhấn "Xác nhận thanh toán"

## Khi nhấn nút "Xác nhận thanh toán", các cột sau sẽ được cập nhật trong bảng `phieu_thu_hoc_phi`:

### 1. **status** (TEXT)
- **Giá trị cũ**: `'unpaid'`
- **Giá trị mới**: `'paid'`
- **Mô tả**: Trạng thái thanh toán của phiếu thu

### 2. **paid_at** (TIMESTAMP WITH TIME ZONE)
- **Giá trị cũ**: `NULL`
- **Giá trị mới**: Thời gian hiện tại (khi nhấn nút)
- **Mô tả**: Thời điểm xác nhận thanh toán
- **Format**: ISO 8601 (ví dụ: `2026-01-17T10:30:00.000Z`)

### 3. **updated_at** (TIMESTAMP WITH TIME ZONE)
- **Giá trị**: Tự động cập nhật bởi trigger
- **Mô tả**: Thời gian cập nhật record lần cuối

### 4. **student_id** (TEXT)
- **Mô tả**: ID học sinh (được cập nhật để đảm bảo dữ liệu đầy đủ)

### 5. **student_name** (TEXT)
- **Mô tả**: Tên học sinh (được cập nhật để đảm bảo dữ liệu đầy đủ)

### 6. **student_code** (TEXT)
- **Mô tả**: Mã học sinh (được cập nhật để đảm bảo dữ liệu đầy đủ)

### 7. **month** (INTEGER)
- **Mô tả**: Tháng (1-12, được convert từ 0-11 trong code)
- **Lưu ý**: Được convert từ JavaScript month (0-11) sang database month (1-12)

### 8. **year** (INTEGER)
- **Mô tả**: Năm

### 9. **total_sessions** (INTEGER)
- **Mô tả**: Tổng số buổi học

### 10. **total_amount** (NUMERIC)
- **Mô tả**: Tổng tiền (trước giảm giá)

### 11. **discount** (NUMERIC)
- **Mô tả**: Số tiền giảm giá

### 12. **final_amount** (NUMERIC)
- **Mô tả**: Thành tiền (sau giảm giá)

### 13. **sessions** (JSONB)
- **Mô tả**: Danh sách các buổi học (dạng JSON)
- **Cấu trúc**: Array of objects với các field:
  - `Ngày`: Ngày học
  - `Tên lớp`: Tên lớp học
  - `Mã lớp`: Mã lớp học
  - `Class ID`: ID lớp học

---

## Tóm tắt

**Các cột QUAN TRỌNG NHẤT được thay đổi:**
1. ✅ **status**: `'unpaid'` → `'paid'`
2. ✅ **paid_at**: `NULL` → `[thời gian hiện tại]`
3. ✅ **updated_at**: Tự động cập nhật

**Các cột khác được cập nhật để đảm bảo dữ liệu đầy đủ:**
- Thông tin học sinh (student_id, student_name, student_code)
- Thông tin thời gian (month, year)
- Thông tin học phí (total_sessions, total_amount, discount, final_amount)
- Danh sách buổi học (sessions)

---

## Lưu ý

- Nếu invoice chưa tồn tại trong Supabase, hệ thống sẽ tự động **tạo mới** (upsert) với tất cả các field trên
- Nếu invoice đã tồn tại, chỉ các field được truyền vào sẽ được **cập nhật**
- Field `updated_at` được tự động cập nhật bởi database trigger, không cần truyền vào
