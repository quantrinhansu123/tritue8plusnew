# Luồng Data của View "Phiếu thu học phí - Nguyễn Trang Linh"

## Tổng Quan

View "Phiếu thu học phí" hiển thị thông tin invoice cho từng học sinh (ví dụ: Nguyễn Trang Linh). Luồng data được mô tả chi tiết dưới đây.

---

## 1. Khi Trang Invoice Load Lần Đầu

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 362-430

### Flow:

1. **useEffect** (dòng 362) subscribe real-time data từ Supabase:
   ```typescript
   supabaseOnValue("datasheet/Phiếu_thu_học_phí", (data) => { ... })
   ```

2. **Load từ bảng `phieu_thu_hoc_phi`** (bảng tổng hợp):
   - Mỗi record trong bảng này đại diện cho 1 invoice của 1 học sinh trong 1 tháng
   - ID format: `{studentId}-{month}-{year}` hoặc ID tự động từ Supabase
   - Fields chính:
     - `studentId`, `studentName`, `studentCode`
     - `month` (1-12), `year`
     - `totalSessions`, `totalAmount`, `discount`, `finalAmount`
     - `status` ("paid" hoặc "unpaid")
     - `sessions[]`: Array các buổi học
     - `classId`, `className`, `classCode`, `subject`
     - `pricePerSession`
     - `debt`: Công nợ từ các tháng trước

3. **Lưu vào state `studentInvoiceStatus`** (dòng 413):
   ```typescript
   setStudentInvoiceStatus(invoiceMap);
   ```
   - Key: ID của invoice (từ database)
   - Value: Invoice object với đầy đủ thông tin

4. **Real-time updates**: Khi có thay đổi trong Supabase, `supabaseOnValue` tự động cập nhật `studentInvoiceStatus`

---

## 2. Load Data Hỗ Trợ (Students, Classes, Sessions, etc.)

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 452-538

### Flow:

1. **useEffect** (dòng 452) load các bảng hỗ trợ:
   - `datasheet/Học_sinh` → `students` state
   - `datasheet/Lớp_học` → `classes` state
   - `datasheet/Điểm_danh_sessions` → `sessions` state
   - `datasheet/Lớp_học/Học_sinh` → `tuitionFees` state (học phí riêng)

2. **Convert format**: Tất cả data được convert từ snake_case (Supabase) sang camelCase (app) thông qua `convertFromSupabaseFormat()`

---

## 3. Tính Toán Invoice List (useMemo)

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 608-855

### Flow:

1. **useMemo `studentInvoices`** (dòng 608) tính toán danh sách invoice từ `studentInvoiceStatus`:

2. **Filter theo tháng/năm được chọn**:
   ```typescript
   const jsMonth = month > 0 ? month - 1 : 0; // Convert DB month (1-12) to JS month (0-11)
   if (jsMonth !== studentMonth || year !== studentYear) return;
   ```

3. **Lấy thông tin từ invoice data**:
   - `studentName`, `studentCode` từ invoice hoặc từ `students` array
   - `className`, `classCode`, `subject`, `pricePerSession` từ invoice
   - `totalSessions`, `totalAmount`, `finalAmount` từ invoice (ưu tiên giá trị từ database)
   - `sessions[]`: Filter chỉ lấy sessions của tháng/năm này

4. **Auto-create invoices từ sessions** (nếu chưa có invoice):
   - Nếu có session điểm danh nhưng chưa có invoice trong database
   - Tự động tạo invoice từ sessions
   - Tính `pricePerSession` từ `getUnitPrice()` (ưu tiên `hoc_phi_rieng`)

5. **Return `invoicesList`**: Array các `StudentInvoice` objects

---

## 4. Khi Click "Xem" Invoice (viewStudentInvoice)

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 3550-3701

### Flow:

1. **viewStudentInvoice(invoice)** được gọi khi click nút "Xem"

2. **getLatestInvoiceData()** (dòng 3565):
   - Lấy invoice mới nhất từ `studentInvoiceStatus[invoice.id]`
   - Nếu không có, dùng `invoice` object từ parameter

3. **generateStudentInvoiceHTML(invoice, includeQR)** (dòng 3571):
   - Generate HTML để hiển thị trong modal
   - Xử lý `invoice.subjects[]` nếu có (nhiều môn học)
   - Hoặc dùng `invoice.sessions[]` để tính toán

4. **Modal hiển thị** (dòng 3650):
   - Title: `Phiếu thu học phí - ${studentName}` (ví dụ: "Phiếu thu học phí - Nguyễn Trang Linh")
   - Content: HTML được generate từ `generateStudentInvoiceHTML()`
   - Footer: Các nút "Reset", "In phiếu (gốc)", "In với giá trị đã chỉnh sửa"

5. **Real-time refresh**: Modal có thể refresh khi có thay đổi từ database

---

## 5. Load Invoice Details (Chi Tiết Từng Môn Học)

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 6384-6416

### Flow:

1. **loadInvoiceDetails(studentId, month, year)** được gọi khi:
   - Expand row trong table
   - Preload cho tất cả students trong tháng hiện tại

2. **Load từ bảng `phieu_thu_hoc_phi_chi_tiet`**:
   ```typescript
   const detailsData = await supabaseGetByStudentMonthYear(
     "datasheet/Phiếu_thu_học_phí_chi_tiết",
     studentId,
     dbMonth, // 1-12
     year
   );
   ```

3. **Cache kết quả** trong `invoiceDetailsCache`:
   - Key: `${studentId}-${dbMonth}-${year}`
   - Value: Object chứa tất cả invoice details của học sinh trong tháng đó

4. **Invoice Details Structure**:
   - Mỗi record trong `phieu_thu_hoc_phi_chi_tiet` = 1 môn học của học sinh
   - ID format: `{studentId}-{classId}-{month}-{year}`
   - Fields:
     - `studentId`, `studentName`, `studentCode`
     - `classId`, `className`, `classCode`, `subject`
     - `month` (1-12), `year`
     - `totalSessions`, `pricePerSession`, `totalAmount`, `discount`, `finalAmount`
     - `status` ("paid" hoặc "unpaid")
     - `sessions[]`: Array các buổi học của môn này

---

## 6. Hiển Thị Trong Expanded Row

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 6466-6545

### Flow:

1. **expandedRowRender(record)** được gọi khi expand row

2. **Lấy invoice details từ cache**:
   ```typescript
   const cacheKey = `${record.studentId}-${dbMonth}-${record.year}`;
   const invoiceDetails = invoiceDetailsCache[cacheKey];
   ```

3. **Group sessions by class**:
   - Từ `invoiceDetails`, group các records theo `classId`
   - Mỗi class = 1 dòng trong expanded row
   - Tính tổng: `sessionCount`, `pricePerSession`, `totalPrice`, `discount`

4. **Render table**:
   - Hiển thị từng môn học (class) với:
     - Tên lớp, Mã lớp
     - Môn học
     - Số buổi, Đơn giá, Thành tiền
     - Giảm giá (có thể edit)
     - Nút "Chỉnh sửa" để edit chi tiết

---

## 7. Generate HTML Invoice (generateStudentInvoiceHTML)

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 5761-5913

### Flow:

1. **Input**: `invoice` object và `includeQR` flag

2. **Xử lý subjects**:
   - Nếu có `invoice.subjects[]`:
     - Mỗi subject = 1 dòng trong bảng invoice
     - Tính `classSummary` từ `subjects[]`
   - Nếu không có `subjects[]`:
     - Dùng `invoice.sessions[]` để tính toán
     - Group sessions theo class/subject

3. **Tính toán totals**:
   - `totalSessions`: Tổng số buổi từ tất cả subjects
   - `totalAmount`: Tổng tiền (trước giảm giá)
   - `discount`: Giảm giá
   - `finalAmount`: Thành tiền (sau giảm giá)
   - `debt`: Công nợ từ các tháng trước

4. **Generate HTML**:
   - Header: Tên học sinh, Mã học sinh, Tháng/Năm
   - Table: Danh sách các môn học với số buổi, đơn giá, thành tiền
   - Footer: Tổng tiền, Giảm giá, Thành tiền, Công nợ, Tổng cộng
   - QR Code (nếu `includeQR === true`)

---

## 8. Data Conversion (convertFromSupabaseFormat)

**File:** `utils/supabaseHelpers.ts`

### Flow:

- Tất cả data từ Supabase được convert tự động:
  - `student_id` → `studentId`
  - `student_name` → `studentName`
  - `price_per_session` → `pricePerSession`
  - `total_sessions` → `totalSessions`
  - `total_amount` → `totalAmount`
  - `final_amount` → `finalAmount`
  - `class_id` → `classId`
  - `class_name` → `className`
  - `class_code` → `classCode`
  - v.v.

- **Lưu ý**:
  - `month` giữ nguyên 1-12 (không convert sang 0-11)
  - `subject` giữ nguyên (không convert)

---

## 9. Tính Công Nợ (getStudentDebtBreakdown)

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 3988-4150

### Flow:

1. **Lấy tất cả invoices từ `studentInvoiceStatus`** (không filter theo tháng)

2. **Filter invoices trước tháng hiện tại**:
   ```typescript
   const isBeforeCurrentMonth = y < currentYear || 
     (y === currentYear && jsMonth < currentMonth);
   ```

3. **Chỉ tính invoices chưa thanh toán**:
   ```typescript
   if (status !== "paid") {
     debt += finalAmount || totalAmount || 0;
   }
   ```

4. **Tính tổng công nợ** từ tất cả các tháng/năm trước

---

## Tóm Tắt Luồng Data Cho "Nguyễn Trang Linh"

1. **Load ban đầu**:
   - `supabaseOnValue("datasheet/Phiếu_thu_học_phí")` → Load tất cả invoices
   - Filter invoice của "Nguyễn Trang Linh" theo `studentId`
   - Lưu vào `studentInvoiceStatus`

2. **Filter theo tháng/năm**:
   - `useMemo studentInvoices` filter invoices theo `studentMonth` và `studentYear`
   - Chỉ hiển thị invoices của tháng/năm được chọn

3. **Khi click "Xem"**:
   - `viewStudentInvoice(invoice)` → Lấy invoice từ `studentInvoiceStatus`
   - `generateStudentInvoiceHTML()` → Generate HTML
   - Hiển thị modal với title "Phiếu thu học phí - Nguyễn Trang Linh"

4. **Chi tiết từng môn học**:
   - `loadInvoiceDetails()` → Load từ `phieu_thu_hoc_phi_chi_tiet`
   - Group theo `classId` để hiển thị từng môn học
   - Cache trong `invoiceDetailsCache`

5. **Real-time updates**:
   - `supabaseOnValue` tự động cập nhật khi có thay đổi
   - Modal có thể refresh với data mới nhất

---

## Bảng Dữ Liệu Liên Quan

1. **`phieu_thu_hoc_phi`** (Phiếu_thu_học_phí):
   - Bảng tổng hợp: 1 record = 1 invoice của 1 học sinh trong 1 tháng
   - Dùng để load `studentInvoiceStatus`

2. **`phieu_thu_hoc_phi_chi_tiet`** (Phiếu_thu_học_phí_chi_tiết):
   - Bảng chi tiết: 1 record = 1 môn học của 1 học sinh trong 1 tháng
   - Dùng để hiển thị chi tiết trong expanded row

3. **`diem_danh_sessions`** (Điểm_danh_sessions):
   - Bảng điểm danh: Chứa thông tin các buổi học
   - Dùng để tính toán invoice nếu chưa có trong database

4. **`lop_hoc_hoc_sinh`** (Lớp_học/Học_sinh):
   - Bảng học phí riêng: Chứa `hoc_phi_rieng` cho từng học sinh trong từng lớp
   - Dùng để tính `pricePerSession` (ưu tiên cao nhất)

---

## Debug Logs

Các log debug quan trọng:
- `📊 Loaded X invoices from Phiếu_thu_học_phí`: Số invoices load được
- `📊 Paid: X, Unpaid: Y`: Số lượng paid/unpaid invoices
- `📋 Loading invoices from Firebase for month X/Y`: Đang load invoices cho tháng nào
- `✅ Preloaded invoice details for X students`: Đã preload details cho bao nhiêu học sinh
- `✅ Updated invoice with Supabase data`: Invoice đã được update với data từ Supabase
