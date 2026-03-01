# Luồng Data Khi Điểm Danh

## Tổng Quan

Khi điểm danh một buổi học, hệ thống sẽ tự động điền data vào **2 bảng chính** trong Supabase:

1. **`diem_danh_sessions`** (Điểm_danh_sessions) - Lưu thông tin điểm danh
2. **`phieu_thu_hoc_phi_chi_tiet`** (Phiếu_thu_học_phí_chi_tiết) - Tự động tạo/cập nhật invoice

---

## 1. Bảng `diem_danh_sessions` (Điểm_danh_sessions)

**File:** `components/pages/AttendanceSession.tsx`  
**Dòng:** 1679-1805

### Khi nào lưu:
- Khi click nút **"Hoàn thành"** sau khi điểm danh xong

### Data được lưu:

#### Nếu là session mới (chưa có trong database):
```typescript
await supabaseSet("datasheet/Điểm_danh_sessions", cleanedData);
```

#### Nếu là session đã tồn tại (đang chỉnh sửa):
```typescript
await supabaseUpdate("datasheet/Điểm_danh_sessions", sessionId, cleanedData);
```

### Cấu trúc data:

```typescript
{
  id: string, // UUID tự động tạo
  "Mã lớp": string, // Mã lớp học
  "Tên lớp": string, // Tên lớp học
  "Class ID": string, // ID của lớp học
  "Ngày": string, // Ngày điểm danh (YYYY-MM-DD)
  "Giờ bắt đầu": string, // Giờ bắt đầu buổi học (HH:mm)
  "Giờ kết thúc": string, // Giờ kết thúc buổi học (HH:mm)
  "Giáo viên": string, // Tên giáo viên
  "Teacher ID": string, // ID giáo viên
  "Trạng thái": "completed", // Trạng thái buổi học
  "Điểm danh": AttendanceRecord[], // Array các bản ghi điểm danh
  "Thời gian điểm danh": string, // Thời gian điểm danh (ISO string)
  "Người điểm danh": string, // Tên người điểm danh
  "Thời gian hoàn thành": string, // Thời gian hoàn thành (ISO string)
  "Người hoàn thành": string, // Tên người hoàn thành
  "Nội dung buổi học": string, // Nội dung buổi học
  "Tài liệu nội dung": any[], // Array tài liệu đính kèm (nếu có)
  "Bài tập": {
    "Mô tả": string, // Mô tả bài tập
    "Tổng số bài": number, // Tổng số bài tập
    "Người giao": string, // Người giao bài tập
    "Thời gian giao": string, // Thời gian giao bài tập
    "Tài liệu đính kèm": any[] // Tài liệu đính kèm (nếu có)
  },
  "Timestamp": string // Timestamp tạo record
}
```

### Chi tiết `AttendanceRecord[]` (Điểm danh):

Mỗi record trong array `Điểm danh` chứa:

```typescript
{
  "Student ID": string, // ID học sinh
  "Tên học sinh": string, // Tên học sinh
  "Có mặt": boolean, // Có mặt hay không
  "Đi muộn"?: boolean, // Đi muộn (nếu có)
  "Vắng có phép"?: boolean, // Vắng có phép (nếu có)
  "Vắng không phép"?: boolean, // Vắng không phép (nếu có)
  "Ghi chú"?: string, // Ghi chú
  "Điểm"?: number, // Điểm bài tập (nếu có)
  "Bài tập hoàn thành"?: number, // Số bài tập hoàn thành
  "% Hoàn thành BTVN"?: number, // % hoàn thành bài tập về nhà
  "Điểm thưởng"?: number, // Điểm thưởng
  "Bài kiểm tra"?: string, // Tên bài kiểm tra
  "Điểm kiểm tra"?: number, // Điểm kiểm tra
  "Chi tiết điểm"?: ScoreDetail[], // Chi tiết điểm
  "Giờ check-in"?: string // Giờ check-in (HH:mm:ss)
}
```

---

## 2. Bảng `phieu_thu_hoc_phi_chi_tiet` (Phiếu_thu_học_phí_chi_tiết)

**File:** `components/pages/AttendanceSession.tsx`  
**Dòng:** 184-474, 1807-1826

### Khi nào lưu:
- **Tự động** sau khi lưu điểm danh vào `diem_danh_sessions`
- Gọi function `syncInvoicesForCurrentSession()` (dòng 1811)

### Data được lưu:

#### Tạo invoice mới (nếu chưa có):
```typescript
await supabaseSet("datasheet/Phiếu_thu_học_phí_chi_tiết", { id: key, ...newInvoice });
```

#### Cập nhật invoice hiện có (nếu đã có):
```typescript
await supabaseSet("datasheet/Phiếu_thu_học_phí_chi_tiết", updatedInvoice);
```

### Cấu trúc data:

```typescript
{
  id: string, // Format: "{studentId}-{classId}-{month}-{year}"
  studentId: string, // ID học sinh
  studentName: string, // Tên học sinh
  studentCode: string, // Mã học sinh
  classId: string, // ID lớp học
  className: string, // Tên lớp học
  classCode: string, // Mã lớp học
  subject: string, // Môn học
  month: number, // Tháng (1-12)
  year: number, // Năm
  totalSessions: number, // Tổng số buổi học
  pricePerSession: number, // Đơn giá mỗi buổi
  totalAmount: number, // Tổng tiền (trước giảm giá)
  discount: number, // Giảm giá
  finalAmount: number, // Thành tiền (sau giảm giá)
  status: "unpaid" | "paid", // Trạng thái thanh toán
  sessions: Array<{ // Array các buổi học
    "Ngày": string, // Ngày buổi học
    "Tên lớp": string, // Tên lớp
    "Mã lớp": string, // Mã lớp
    "Class ID": string // ID lớp
  }>,
  debt: number // Công nợ từ các tháng trước
}
```

### Logic tạo/cập nhật invoice:

1. **Học sinh có mặt hoặc vắng có phép**:
   - Nếu invoice chưa có → Tạo mới
   - Nếu invoice đã có:
     - Nếu invoice đã **paid** → Tạo invoice bổ sung với key `{studentId}-{classId}-{month}-{year}-extra`
     - Nếu invoice chưa **paid** → Thêm buổi học vào invoice hiện có

2. **Học sinh vắng không phép**:
   - Xóa buổi học khỏi invoice (nếu invoice chưa paid)
   - Nếu không còn buổi nào → Xóa invoice

3. **Tính giá**:
   - Ưu tiên: `hoc_phi_rieng` từ bảng `lop_hoc_hoc_sinh`
   - Fallback: Giá từ lớp học hoặc khóa học

---

## 3. Cập Nhật Giá Từ Học Phí Riêng (Tự Động)

**File:** `components/pages/AttendanceSession.tsx`  
**Dòng:** 476-600

### Khi nào chạy:
- **Tự động** sau khi sync invoices (dòng 1811)
- Gọi function `updateInvoicePricesFromHocPhiRieng()` (dòng 470)

### Data được cập nhật:

```typescript
await supabaseUpdate("datasheet/Phiếu_thu_học_phí_chi_tiết", detailId, {
  pricePerSession: hocPhiRieng, // Cập nhật từ hoc_phi_rieng
  totalAmount: newTotalAmount, // Tính lại tổng tiền
  finalAmount: newFinalAmount // Tính lại thành tiền
});
```

### Logic:

1. Load `hoc_phi_rieng` từ bảng `lop_hoc_hoc_sinh`
2. Tìm các invoice của tháng hiện tại
3. Cập nhật `pricePerSession` từ `hoc_phi_rieng` (nếu có)
4. Tính lại `totalAmount` và `finalAmount`

---

## 4. Đồng Bộ Báo Cáo Tháng (Tự Động)

**File:** `components/pages/AttendanceSession.tsx`  
**Dòng:** 1818-1826

### Khi nào chạy:
- **Tự động** sau khi sync invoices
- Gọi function `syncMonthlyReportsForSession()`

### Data được cập nhật:

- Bảng `nhan_xet_thang` (Nhận_xét_tháng)
- Cập nhật thống kê điểm danh cho học sinh trong tháng

---

## Tóm Tắt Luồng Data

### Khi điểm danh và click "Hoàn thành":

1. **Lưu điểm danh** → `diem_danh_sessions`
   - Tạo mới hoặc cập nhật session
   - Lưu thông tin: học sinh, có mặt, điểm, bài tập, v.v.

2. **Tự động sync invoices** → `phieu_thu_hoc_phi_chi_tiet`
   - Tạo/cập nhật invoice cho học sinh có mặt
   - Tính số buổi, tổng tiền, giảm giá

3. **Tự động cập nhật giá** → `phieu_thu_hoc_phi_chi_tiet`
   - Cập nhật `pricePerSession` từ `hoc_phi_rieng`
   - Tính lại `totalAmount` và `finalAmount`

4. **Tự động đồng bộ báo cáo** → `nhan_xet_thang`
   - Cập nhật thống kê điểm danh

---

## Bảng Dữ Liệu Liên Quan

### Bảng được điền trực tiếp:

1. **`diem_danh_sessions`** (Điểm_danh_sessions)
   - Lưu thông tin điểm danh buổi học
   - Mỗi record = 1 buổi học

2. **`phieu_thu_hoc_phi_chi_tiet`** (Phiếu_thu_học_phí_chi_tiết)
   - Lưu invoice chi tiết từng môn học
   - Mỗi record = 1 môn học của 1 học sinh trong 1 tháng

### Bảng được đọc (không điền):

1. **`hoc_sinh`** (Học_sinh) - Đọc thông tin học sinh
2. **`lop_hoc`** (Lớp_học) - Đọc thông tin lớp học
3. **`lop_hoc_hoc_sinh`** (Lớp_học/Học_sinh) - Đọc `hoc_phi_rieng`
4. **`khoa_hoc`** (Khóa_học) - Đọc giá khóa học (nếu có)

### Bảng được cập nhật (không điền trực tiếp):

1. **`nhan_xet_thang`** (Nhận_xét_tháng) - Cập nhật thống kê điểm danh

---

## Lưu Ý Quan Trọng

1. **ID Format**:
   - `diem_danh_sessions`: UUID tự động tạo
   - `phieu_thu_hoc_phi_chi_tiet`: `{studentId}-{classId}-{month}-{year}`

2. **Month Format**:
   - Trong `diem_danh_sessions`: `Ngày` là string (YYYY-MM-DD)
   - Trong `phieu_thu_hoc_phi_chi_tiet`: `month` là number (1-12)

3. **Real-time Updates**:
   - Tất cả thay đổi được sync real-time qua `supabaseOnValue`
   - Invoice page tự động cập nhật khi có thay đổi

4. **Invoice Status**:
   - Invoice mới tạo có `status = "unpaid"`
   - Invoice đã paid không bị sửa, chỉ tạo invoice bổ sung

5. **Học phí riêng**:
   - Ưu tiên cao nhất: `hoc_phi_rieng` từ `lop_hoc_hoc_sinh`
   - Nếu không có → Dùng giá từ lớp học hoặc khóa học
