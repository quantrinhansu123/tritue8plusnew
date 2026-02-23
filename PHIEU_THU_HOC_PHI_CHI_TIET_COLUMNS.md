# Logic điền từng cột của bảng `phieu_thu_hoc_phi_chi_tiet`

## Tổng quan

Khi nhấn nút "Tính học phí", hệ thống sẽ:
1. Xóa tất cả invoices cũ của tháng/năm đã chọn
2. Tính toán lại từ `diem_danh_sessions`
3. Lưu vào `phieu_thu_hoc_phi_chi_tiet` (bảng chi tiết)
4. Tổng hợp và lưu vào `phieu_thu_hoc_phi` (bảng tổng hợp)

## Logic điền từng cột

### 1. `id` (TEXT PRIMARY KEY)
- **Format**: `${studentId}-${classId}-${finalMonth}-${finalYear}`
- **Ví dụ**: `-OgBnlEHOk4DQEkPfRdU--OlBhlau...-2-2026`
- **Logic**:
  - Nếu có invoice cũ: dùng `existingInvoiceId` (giữ nguyên ID)
  - Nếu không có: tạo mới theo format trên
- **Nguồn**: Tạo từ `studentId`, `classId`, `finalMonth`, `finalYear`

### 2. `student_id` (TEXT NOT NULL)
- **Lấy từ**: `studentId` trong `studentSessionsMap`
- **Nguồn**: `record["Student ID"]` từ `session["Điểm danh"]`
- **Ví dụ**: `-OgBnlEHOk4DQEkPfRdU`

### 3. `student_name` (TEXT)
- **Lấy từ**: `student["Họ và tên"]`
- **Nguồn**: Bảng `hoc_sinh` (students array)
- **Ví dụ**: `"Nguyễn Văn A"`

### 4. `student_code` (TEXT)
- **Lấy từ**: `student["Mã học sinh"]`
- **Nguồn**: Bảng `hoc_sinh` (students array)
- **Ví dụ**: `"HS001"`

### 5. `class_id` (TEXT NOT NULL)
- **Lấy từ**: `classId` trong `studentSessionsMap`
- **Nguồn**: `session["Class ID"]`
- **Ví dụ**: `-OlBhlau...`

### 6. `class_name` (TEXT)
- **Lấy từ**: `classInfo["Tên lớp"]`
- **Nguồn**: Bảng `lop_hoc` (classes array)
- **Ví dụ**: `"Toán 12"`

### 7. `class_code` (TEXT)
- **Lấy từ**: `classInfo["Mã lớp"]`
- **Nguồn**: Bảng `lop_hoc` (classes array)
- **Ví dụ**: `"T12"`

### 8. `subject` (TEXT)
- **Lấy từ**: `classInfo["Môn học"]`
- **Nguồn**: Bảng `lop_hoc` (classes array)
- **Ví dụ**: `"Toán"`

### 9. `month` (INTEGER, 1-12) ⚠️ QUAN TRỌNG
- **Lấy từ**: `finalMonth = Number(studentMonth)`
- **Nguồn**: Filter UI (`studentMonth` state)
- **KHÔNG lấy từ session date**
- **Ví dụ**: 
  - Chọn "Tháng 2" trong filter UI → `studentMonth = 2` → `finalMonth = 2` → `month = 2`
  - Chọn "Tháng 3" trong filter UI → `studentMonth = 3` → `finalMonth = 3` → `month = 3`
- **Validation**: 
  - `finalMonth` phải bằng `studentMonth` (nếu không → báo lỗi và bỏ qua)
  - `finalMonth` phải trong khoảng 1-12

### 10. `year` (INTEGER)
- **Lấy từ**: `finalYear = Number(studentYear)`
- **Nguồn**: Filter UI (`studentYear` state)
- **KHÔNG lấy từ session date**
- **Ví dụ**: `2026`

### 11. `total_sessions` (INTEGER)
- **Tính**: `totalSessions = studentSessions.length`
- **Nguồn**: Số lượng sessions trong `studentSessions` array
- **Logic**:
  - Filter sessions theo `studentMonth` và `studentYear` (từ filter UI)
  - Chỉ lấy sessions có `"Có mặt" === true`
  - Đếm số lượng sessions trong group
- **Ví dụ**: `4` (nếu có 4 buổi có mặt)

### 12. `price_per_session` (NUMERIC)
- **Priority 1**: `session["Học phí mỗi buổi"]` (nếu có trong session điểm danh)
- **Priority 2**: `getUnitPrice()` → `hoc_phi_rieng` → class/course price
- **Nếu không có giá**: Bỏ qua (không tạo invoice)
- **Ví dụ**: `50000` (50,000 đ/buổi)

### 13. `total_amount` (NUMERIC)
- **Tính**: `totalAmount = totalSessions * pricePerSession`
- **Ví dụ**: `4 * 50000 = 200000` (200,000 đ)

### 14. `discount` (NUMERIC)
- **Lấy từ**: `existingDiscount` (nếu có invoice cũ)
- **Nếu không có**: `0`
- **Logic**: Giữ lại giá trị cũ khi update invoice
- **Ví dụ**: `10000` (10,000 đ giảm giá)

### 15. `final_amount` (NUMERIC)
- **Tính**: `finalAmount = totalAmount - existingDiscount`
- **Ví dụ**: `200000 - 10000 = 190000` (190,000 đ)

### 16. `status` (TEXT: 'paid' | 'unpaid')
- **Lấy từ**: `existingStatus` (nếu có invoice cũ)
- **Nếu không có**: `"unpaid"`
- **Logic**: Giữ lại giá trị cũ khi update invoice
- **Ví dụ**: `"unpaid"` hoặc `"paid"`

### 17. `sessions` (JSONB)
- **Format**: Array of objects
- **Mỗi object chứa**:
  ```json
  {
    "Ngày": "01/02/2026",
    "Tên lớp": "Toán 12",
    "Mã lớp": "T12",
    "Class ID": "-OlBhlau..."
  }
  ```
- **Nguồn**: `studentSessions.map(session => ({ ... }))`
- **Ví dụ**: 
  ```json
  [
    {"Ngày": "01/02/2026", "Tên lớp": "Toán 12", "Mã lớp": "T12", "Class ID": "-OlBhlau..."},
    {"Ngày": "04/02/2026", "Tên lớp": "Toán 12", "Mã lớp": "T12", "Class ID": "-OlBhlau..."}
  ]
  ```

### 18. `debt` (NUMERIC)
- **Lấy từ**: `existingDebt` (nếu có invoice cũ)
- **Nếu không có**: `0`
- **Logic**: Giữ lại giá trị cũ khi update invoice
- **Ví dụ**: `50000` (50,000 đ công nợ)

### 19. `invoice_image` (TEXT)
- **Không được điền** trong `calculateAndSaveInvoices`
- **Được điền khi**: User upload ảnh phiếu thu

### 20. `paid_at` (TIMESTAMP)
- **Không được điền** trong `calculateAndSaveInvoices`
- **Được điền khi**: User đánh dấu "paid"

### 21. `notes` (TEXT)
- **Không được điền** trong `calculateAndSaveInvoices`
- **Được điền khi**: User thêm ghi chú

### 22. `metadata` (JSONB)
- **Không được điền** trong `calculateAndSaveInvoices`
- **Mặc định**: `{}`

### 23. `created_at` (TIMESTAMP)
- **Tự động**: `DEFAULT NOW()` (khi tạo mới)

### 24. `updated_at` (TIMESTAMP)
- **Tự động**: `DEFAULT NOW()` (khi update)

---

## Ví dụ cụ thể

### Khi chọn "Tháng 2" trong filter UI:

1. **Filter UI**: `studentMonth = 2`, `studentYear = 2026`
2. **Filter sessions**: Chỉ lấy sessions có month = 2, year = 2026
3. **Group sessions**: Group theo `studentId-classId`
4. **Tính toán**:
   - `totalSessions = 4` (4 buổi có mặt)
   - `pricePerSession = 50000` (từ session hoặc học phí riêng)
   - `totalAmount = 4 * 50000 = 200000`
5. **Lưu vào database**:
   - `month = 2` ✅ (lấy từ `studentMonth = 2`)
   - `year = 2026` ✅ (lấy từ `studentYear = 2026`)
   - `total_sessions = 4`
   - `price_per_session = 50000`
   - `total_amount = 200000`

### Validation

- ✅ `finalMonth === studentMonth` (phải đúng, nếu không → báo lỗi)
- ✅ `finalMonth >= 1 && finalMonth <= 12` (phải hợp lệ)
- ✅ `finalYear >= 2000 && finalYear <= 2100` (phải hợp lệ)

---

## Lưu ý quan trọng

1. **Month/Year**: Luôn lấy từ filter UI (`studentMonth`/`studentYear`), KHÔNG từ session date
2. **Total sessions**: Đếm từ sessions có "Có mặt" === true, đã filter theo tháng/năm
3. **Price**: Ưu tiên từ session, sau đó học phí riêng/class/course
4. **Discount/Debt/Status**: Giữ lại từ invoice cũ (nếu có)
