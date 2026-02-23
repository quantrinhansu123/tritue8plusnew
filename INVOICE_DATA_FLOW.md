# Cách Trang Invoice Lấy Data

## 1. Khi Trang Load Lần Đầu (useEffect)

**File:** `components/pages/InvoicePage.tsx`
**Dòng:** 444-694

### Flow:
1. **useEffect** gọi `loadData()` khi component mount
2. **loadData()** gọi `supabaseGetAll("datasheet/Phiếu_thu_học_phí_chi_tiết")` để load TẤT CẢ records từ bảng chi tiết
3. **Group records** theo key: `studentId-month-year`
   - Mỗi học sinh trong 1 tháng có thể có nhiều môn học (nhiều records)
   - Tất cả records cùng `studentId-month-year` được group thành 1 invoice
4. **Tạo invoice object** với:
   - `id`: `studentId-month-year`
   - `subjects[]`: Mảng các môn học (mỗi record chi tiết = 1 môn học)
   - Các field khác: `studentName`, `totalSessions`, `totalAmount`, `pricePerSession`, v.v.
5. **Lưu vào state** `studentInvoiceStatus` (dòng 664)
   - Key: `studentId-month-year`
   - Value: Invoice object với `subjects[]` array

### Code chính:
```typescript
// Load từ Supabase
const invoicesDataChiTiet = await supabaseGetAll("datasheet/Phiếu_thu_học_phí_chi_tiết");

// Group theo studentId-month-year
Object.entries(invoicesDataChiTiet).forEach(([id, invoiceDetail]) => {
  const studentId = invoiceDetail.studentId || invoiceDetail.student_id || "";
  const month = invoiceDetail.month !== undefined ? invoiceDetail.month : 0;
  const year = invoiceDetail.year !== undefined ? invoiceDetail.year : 0;
  const groupKey = `${studentId}-${month}-${year}`;
  
  if (!groupedInvoices[groupKey]) {
    // Tạo invoice mới với subjects array
    groupedInvoices[groupKey] = {
      id: groupKey,
      subjects: [{
        subject: invoiceDetail.subject,
        pricePerSession: invoiceDetail.pricePerSession || invoiceDetail.price_per_session,
        // ... các field khác
      }],
      // ... các field khác
    };
  } else {
    // Thêm môn học vào subjects array
    existing.subjects.push({
      subject: invoiceDetail.subject,
      pricePerSession: invoiceDetail.pricePerSession || invoiceDetail.price_per_session,
      // ... các field khác
    });
  }
});

// Lưu vào state
setStudentInvoiceStatus(convertedData);
```

## 2. Real-time Updates (supabaseOnValue)

**File:** `components/pages/InvoicePage.tsx`
**Dòng:** 696-800

### Flow:
- Subscribe real-time changes từ bảng `phieu_thu_hoc_phi_chi_tiet`
- Khi có thay đổi, tự động group lại và update `studentInvoiceStatus`

## 3. Khi Mở Invoice Modal (viewStudentInvoice)

**File:** `components/pages/InvoicePage.tsx`
**Dòng:** 4128-4182

### Flow:
1. **viewStudentInvoice(invoice)** được gọi khi click "Xem"
2. **getLatestInvoiceData()** gọi `loadInvoiceDataFromSupabase(invoice.id)`
3. **loadInvoiceDataFromSupabase()** (dòng 3930-4083):
   - Load lại TẤT CẢ records từ `supabaseGetAll("datasheet/Phiếu_thu_học_phí_chi_tiết")`
   - Parse `invoiceId` để lấy `studentId`, `month`, `year`
   - Filter chỉ lấy records match với `invoiceId` (so sánh `groupKey === invoiceId`)
   - Group lại và tạo invoice object với `subjects[]` array
   - Return invoice object

### Code chính:
```typescript
const loadInvoiceDataFromSupabase = async (invoiceId: string) => {
  // Load từ Supabase
  const invoicesDataChiTiet = await supabaseGetAll("datasheet/Phiếu_thu_học_phí_chi_tiết");
  
  // Parse invoiceId: "studentId-month-year"
  const parts = invoiceId.split('-');
  const studentId = parts.slice(0, -2).join('-');
  const month = parseInt(parts[parts.length - 2]);
  const year = parseInt(parts[parts.length - 1]);
  
  // Filter và group
  Object.entries(invoicesDataChiTiet).forEach(([id, invoiceDetail]) => {
    const groupKey = `${detailStudentId}-${detailMonth}-${detailYear}`;
    if (groupKey === invoiceId) {
      // Group records thành invoice với subjects[]
    }
  });
  
  return groupedInvoices[invoiceId];
};
```

## 4. Hiển Thị Trong Modal (generateStudentInvoiceHTML)

**File:** `components/pages/InvoicePage.tsx`
**Dòng:** 5761-5913

### Flow:
1. **generateStudentInvoiceHTML(invoice, includeQR)** được gọi
2. **Kiểm tra `invoice.subjects[]`**:
   - Nếu có `invoice.subjects` và `invoice.subjects.length > 0`:
     - Dùng `invoice.subjects` để tạo `classSummary`
     - Mỗi subject trong `subjects[]` = 1 dòng trong bảng
   - Nếu không có `subjects[]`:
     - Fallback về `invoice.className` và `invoice.pricePerSession` (cấu trúc cũ)
     - Hoặc dùng `invoice.sessions[]` để tính toán
3. **Tạo `classRows`** từ `classSummary`
4. **Tạo `subjectsForTable`** từ `classRows`
5. **Render HTML** với `subjectsForTable.map()` để tạo các dòng trong bảng

### Code chính:
```typescript
if (invoice.subjects && Array.isArray(invoice.subjects) && invoice.subjects.length > 0) {
  invoice.subjects.forEach((subjectDetail, index) => {
    const pricePerSession = subjectDetail.pricePerSession || subjectDetail.price_per_session || 0;
    const subject = subjectDetail.subject || "";
    
    classSummary[key] = {
      subject: subject,
      pricePerSession: pricePerSession,
      sessionCount: subjectDetail.totalSessions,
      totalPrice: subjectDetail.totalAmount,
    };
  });
}

const classRows = Object.values(classSummary);
const subjectsForTable = currentMonthRows.map((r) => ({
  subject: r.subject,
  pricePerSession: r.pricePerSession,
  sessions: r.sessions,
  total: r.totalPrice,
}));
```

## 5. Data Conversion (convertFromSupabaseFormat)

**File:** `utils/supabaseHelpers.ts`
**Dòng:** 21-286

### Flow:
- `supabaseGetAll()` tự động gọi `convertFromSupabaseFormat()` cho mỗi record
- Convert snake_case → camelCase:
  - `price_per_session` → `pricePerSession`
  - `student_name` → `studentName`
  - `total_sessions` → `totalSessions`
  - `total_amount` → `totalAmount`
  - v.v.

### Lưu ý:
- Field `subject` KHÔNG bị convert (giữ nguyên)
- Field `month` giữ nguyên 1-12 (không convert sang 0-11)

## Tóm Tắt

1. **Load ban đầu**: `useEffect` → `loadData()` → `supabaseGetAll()` → Group → `setStudentInvoiceStatus()`
2. **Real-time**: `supabaseOnValue()` → Auto update `studentInvoiceStatus`
3. **Mở modal**: `viewStudentInvoice()` → `loadInvoiceDataFromSupabase()` → Load lại từ Supabase → `generateStudentInvoiceHTML()`
4. **Hiển thị**: `invoice.subjects[]` → `classSummary` → `classRows` → `subjectsForTable` → Render HTML

## Debug Logs

Các log debug đã được thêm vào:
- `📊 Loaded invoicesDataChiTiet`: Số records load được
- `📋 Processing invoice record`: Chi tiết từng record
- `✅ Loaded invoice from Supabase`: Invoice được load thành công
- `🔍 generateStudentInvoiceHTML - invoice data`: Data khi generate HTML
- `📊 classSummary and classRows`: Summary và rows được tạo
- `📋 subjectsForTable`: Data cuối cùng để render
