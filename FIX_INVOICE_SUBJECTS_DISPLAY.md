# Sửa Lỗi Không Hiển Thị Môn Học và Số Buổi Trong Phiếu Thu

## Vấn Đề

Khi mở view "Phiếu thu học phí", bảng chi tiết (Môn học, Lớp, Buổi, Đơn giá, Thành tiền) đang trống, không hiển thị dữ liệu.

## Nguyên Nhân

### 1. Logic Build `classSummary` Không Fallback Đúng

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 4621-4678

**Vấn đề:**
- Khi không có `classPriceMap` và `classSessionCountMap` từ `phieu_thu_hoc_phi_chi_tiet`, code chỉ lấy giá từ `phieu_thu_hoc_phi_chi_tiet`
- Nếu không có trong `phieu_thu_hoc_phi_chi_tiet`, giá sẽ = 0
- Không fallback về `getUnitPrice()` để lấy giá từ `hoc_phi_rieng`, `lop_hoc`, hoặc `khoa_hoc`

**Hậu quả:**
- `classSummary` rỗng hoặc có giá = 0
- `subjectsForTable` rỗng
- Bảng không hiển thị dữ liệu

### 2. Logic So Sánh Month Sai

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 658-669

**Vấn đề:**
- `month` từ database là 1-12
- `sMonth` từ JavaScript Date là 0-11
- So sánh `sMonth === month` sẽ luôn sai (trừ tháng 1)

**Hậu quả:**
- `validSessions` bị filter hết
- `invoice.sessions` rỗng
- Không có data để build `classSummary`

---

## Giải Pháp

### Fix 1: Thêm Fallback Về `getUnitPrice()`

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 4621-4678

**Thay đổi:**
- Khi không có `classPriceMap`, fallback về `getUnitPrice()` để lấy giá
- `getUnitPrice()` sẽ lấy giá theo thứ tự ưu tiên:
  1. `hoc_phi_rieng` từ `lop_hoc_hoc_sinh`
  2. Giá từ `lop_hoc`
  3. Giá từ `khoa_hoc`

**Code:**
```typescript
} else {
  console.log(`⚠️ No classPriceMap available, will build from invoice.sessions with fallback pricing`);
  
  if (invoice.sessions && invoice.sessions.length > 0) {
    invoice.sessions.forEach((session) => {
      // ... existing code ...
      
      if (!classSummary[key]) {
        // Fallback: Lấy giá từ getUnitPrice() nếu không có trong phieu_thu_hoc_phi_chi_tiet
        let pricePerSession = 0;
        
        // Ưu tiên: classPriceMap > getUnitPrice()
        if (invoiceWithSupabaseData?.classPriceMap && invoiceWithSupabaseData.classPriceMap[classId] !== undefined) {
          pricePerSession = invoiceWithSupabaseData.classPriceMap[classId] || 0;
        } else {
          // Fallback về getUnitPrice() để lấy giá từ hoc_phi_rieng, lop_hoc, hoặc khoa_hoc
          pricePerSession = getUnitPrice(invoice.studentId, subject, classId, invoice.pricePerSession);
        }
        
        classSummary[key] = {
          classId: classId || "",
          className,
          classCode,
          subject,
          sessionCount: 0,
          pricePerSession: pricePerSession,
          totalPrice: 0,
        };
      }
      
      classSummary[key].sessionCount++;
      classSummary[key].totalPrice = classSummary[key].pricePerSession * classSummary[key].sessionCount;
    });
  }
}
```

### Fix 2: Sửa Logic So Sánh Month

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 658-669

**Thay đổi:**
- Convert DB month (1-12) sang JS month (0-11) trước khi so sánh

**Code:**
```typescript
// Convert DB month (1-12) to JS month (0-11) for comparison
const jsMonth = month > 0 ? month - 1 : 0;
validSessions = invoiceData.sessions.filter((session: any) => {
  if (!session["Ngày"]) return false;
  try {
    const sessionDate = new Date(session["Ngày"]);
    const sMonth = sessionDate.getMonth(); // 0-11
    const sYear = sessionDate.getFullYear();
    // Only include sessions that match the invoice month/year
    return sMonth === jsMonth && sYear === year;
  } catch (e) {
    return false;
  }
});
```

---

## Luồng Data Sau Khi Sửa

### Khi Mở Invoice Modal:

1. **Load từ `phieu_thu_hoc_phi_chi_tiet`**:
   - Gọi `supabaseGetByStudentMonthYear()` để load invoice details
   - Tạo `classPriceMap`, `classSessionCountMap`, `classTotalAmountMap`

2. **Build `classSummary`**:
   - **Nếu có `classPriceMap`**: Dùng data từ `phieu_thu_hoc_phi_chi_tiet`
   - **Nếu không có `classPriceMap`**: 
     - Build từ `invoice.sessions`
     - Fallback về `getUnitPrice()` để lấy giá

3. **Tạo `subjectsForTable`**:
   - Từ `classSummary` → `classRows` → `currentMonthRows` → `subjectsForTable`
   - Mỗi row = 1 môn học với: subject, className, sessions, pricePerSession, total

4. **Render HTML**:
   - `subjectsForTable.map()` để tạo các dòng trong bảng
   - Hiển thị: Môn học, Lớp, Buổi, Đơn giá, Thành tiền

---

## Kiểm Tra

### Các Trường Hợp Cần Kiểm Tra:

1. **Invoice có data trong `phieu_thu_hoc_phi_chi_tiet`**:
   - ✅ Hiển thị từ `classPriceMap` và `classSessionCountMap`

2. **Invoice chưa có data trong `phieu_thu_hoc_phi_chi_tiet`**:
   - ✅ Build từ `invoice.sessions`
   - ✅ Fallback về `getUnitPrice()` để lấy giá

3. **Invoice không có `sessions`**:
   - ⚠️ `classSummary` sẽ rỗng
   - ⚠️ Cần đảm bảo invoice có `sessions` trong database

### Debug Logs:

- `📊 Loading invoice details for modal with filters`: Thông tin filter
- `📊 Loaded X records from phieu_thu_hoc_phi_chi_tiet`: Số records load được
- `📊 Processing X invoice details`: Chi tiết từng record
- `📋 Building classSummary from Supabase data`: Build từ Supabase
- `⚠️ No classPriceMap available`: Fallback về invoice.sessions
- `📋 Building classSummary for class X`: Chi tiết từng lớp
- `📋 Final classSummary`: Kết quả cuối cùng

---

## Lưu Ý

1. **Đảm bảo invoice có `sessions`**:
   - Invoice phải có `sessions[]` trong database
   - Nếu không có, cần sync lại từ `diem_danh_sessions`

2. **Đảm bảo `phieu_thu_hoc_phi_chi_tiet` có data**:
   - Sau khi điểm danh, data sẽ tự động sync vào `phieu_thu_hoc_phi_chi_tiet`
   - Nếu chưa có, có thể dùng nút "Update học phí" để sync lại

3. **Month format**:
   - Database: 1-12
   - JavaScript Date: 0-11
   - Luôn convert khi so sánh

---

## Kết Luận

Sau khi sửa:
- ✅ Logic fallback về `getUnitPrice()` khi không có `classPriceMap`
- ✅ Logic so sánh month đúng (convert 1-12 → 0-11)
- ✅ `classSummary` sẽ luôn có data (nếu invoice có `sessions`)
- ✅ `subjectsForTable` sẽ có data để hiển thị

**Nếu vẫn không hiển thị**, kiểm tra:
1. Invoice có `sessions[]` trong database không?
2. `phieu_thu_hoc_phi_chi_tiet` có data cho học sinh/tháng này không?
3. Console logs để xem `classSummary` có data không?
