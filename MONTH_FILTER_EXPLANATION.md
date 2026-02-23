# Cách Bộ Lọc Tháng Lấy Data

## 1. Khởi Tạo Bộ Lọc Tháng

**File:** `components/pages/InvoicePage.tsx`
**Dòng:** 204

```typescript
const [studentMonth, setStudentMonth] = useState(dayjs().month());
const [studentYear, setStudentYear] = useState(dayjs().year());
```

- `studentMonth`: **0-11** (0 = Tháng 1, 11 = Tháng 12) - Format của dayjs/JavaScript
- `studentYear`: Năm (ví dụ: 2026)

## 2. Data Từ Supabase

**Format trong Supabase:**
- `month`: **1-12** (1 = Tháng 1, 12 = Tháng 12) - Format của database
- `year`: Năm (ví dụ: 2026)

## 3. Cách Filter Trong `studentInvoices`

**File:** `components/pages/InvoicePage.tsx`
**Dòng:** 921-981

```typescript
const studentInvoices = useMemo(() => {
  // Load tất cả invoices từ studentInvoiceStatus
  Object.entries(studentInvoiceStatus).forEach(([key, data]) => {
    const month = invoiceData.month ?? 0; // Month là 1-12 từ database
    const year = invoiceData.year ?? 0;
    
    // Convert studentMonth (0-11) sang 1-12 để so sánh với month từ database (1-12)
    const monthForComparison = studentMonth + 1;
    if (month !== monthForComparison || year !== studentYear) {
      return; // Skip invoice không match
    }
    
    // ... thêm invoice vào invoicesList
  });
}, [studentInvoiceStatus, studentMonth, studentYear, ...]);
```

**Logic:**
- `studentMonth` (0-11) + 1 = `monthForComparison` (1-12)
- So sánh `invoice.month` (1-12 từ DB) với `monthForComparison` (1-12)
- Chỉ lấy invoices có `month === monthForComparison` và `year === studentYear`

## 4. Cách Filter Trong `filteredStudentInvoices`

**File:** `components/pages/InvoicePage.tsx`
**Dòng:** 1554-1649

```typescript
const filteredStudentInvoices = useMemo(() => {
  const filtered = studentInvoices.filter((invoice) => {
    // Filter by month
    // Convert studentMonth (0-11) sang 1-12 để so sánh với invoice.month từ database (1-12)
    const monthForComparison = studentMonth + 1;
    const matchMonth = invoice.month !== undefined && invoice.month === monthForComparison;
    
    // Filter by year
    const matchYear = invoice.year !== undefined && invoice.year === studentYear;
    
    return matchSearch && matchMonth && matchYear && matchStatus && matchClass && matchTeacher;
  });
}, [studentInvoices, studentMonth, studentYear, ...]);
```

**Logic:**
- Tương tự như trên: Convert `studentMonth + 1` để so sánh
- Filter thêm theo search term, status, class, teacher

## 5. UI DatePicker

**File:** `components/pages/InvoicePage.tsx`
**Dòng:** 8512-8519

```typescript
<DatePicker
  picker="month"
  value={dayjs().month(studentMonth).year(studentYear)}
  onChange={(date) => {
    if (date) {
      setStudentMonth(date.month()); // 0-11
      setStudentYear(date.year());
    }
  }}
/>
```

**Logic:**
- DatePicker trả về `date.month()` là 0-11
- Lưu vào `studentMonth` (0-11)
- Khi filter, convert `studentMonth + 1` để so sánh với database (1-12)

## 6. Ví Dụ Cụ Thể

### Ví dụ 1: Chọn Tháng 2 (February)
- User chọn: Tháng 2 trong DatePicker
- `studentMonth` = 1 (vì 0 = Jan, 1 = Feb)
- `monthForComparison` = 1 + 1 = 2
- So sánh với `invoice.month` từ DB = 2
- ✅ Match → Hiển thị invoice

### Ví dụ 2: Chọn Tháng 12 (December)
- User chọn: Tháng 12 trong DatePicker
- `studentMonth` = 11 (vì 11 = Dec)
- `monthForComparison` = 11 + 1 = 12
- So sánh với `invoice.month` từ DB = 12
- ✅ Match → Hiển thị invoice

## 7. Vấn Đề Tiềm Ẩn

### Vấn đề 1: Inconsistency
- `studentMonth` là 0-11 (JavaScript format)
- `invoice.month` từ DB là 1-12 (Database format)
- Phải convert mỗi lần so sánh: `studentMonth + 1`

### Vấn đề 2: Fallback Value
```typescript
const month = invoiceData.month ?? 0; // Nếu null/undefined → 0
```
- Nếu `invoice.month` là `null` hoặc `undefined`, fallback về `0`
- Nhưng `0` không phải là giá trị hợp lệ (DB là 1-12)
- Có thể gây lỗi khi so sánh

## 8. Giải Pháp Đề Xuất

### Option 1: Giữ nguyên (hiện tại)
- Convert `studentMonth + 1` mỗi lần so sánh
- Đảm bảo comment rõ ràng

### Option 2: Normalize ngay từ đầu
- Convert `studentMonth` sang 1-12 ngay khi set từ DatePicker
- Không cần convert mỗi lần so sánh
- Nhưng cần convert lại khi hiển thị trong DatePicker

## 9. Tóm Tắt

**Flow hiện tại:**
1. User chọn tháng trong DatePicker → `studentMonth` = 0-11
2. Load invoices từ `studentInvoiceStatus` (đã có month 1-12 từ DB)
3. Filter: Convert `studentMonth + 1` → so sánh với `invoice.month` (1-12)
4. Chỉ hiển thị invoices match

**Điểm quan trọng:**
- ✅ Code đang convert đúng: `studentMonth + 1` để so sánh
- ⚠️ Cần đảm bảo `invoice.month` từ DB luôn là 1-12 (không null/undefined)
- ⚠️ Fallback `?? 0` có thể gây vấn đề nếu DB trả về null
