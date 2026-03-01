# Logic của `classPriceMap`

## Tổng Quan

`classPriceMap` là một object map lưu **đơn giá mỗi buổi học** (`price_per_session`) cho từng lớp học (`classId`). Nó được tạo từ dữ liệu trong bảng `phieu_thu_hoc_phi_chi_tiet` và dùng để hiển thị giá chính xác trong phiếu thu.

---

## 1. Khi Nào `classPriceMap` Được Tạo?

**File:** `components/pages/InvoicePage.tsx`  
**Function:** `viewStudentInvoice()`  
**Dòng:** 3427-3539

### Flow:

1. **Khi click "Xem" invoice** → Gọi `viewStudentInvoice(invoice)`

2. **Load data từ `phieu_thu_hoc_phi_chi_tiet`**:
   ```typescript
   invoiceDetailsData = await supabaseGetByStudentMonthYear(
     "datasheet/Phiếu_thu_học_phí_chi_tiết",
     invoice.studentId,
     dbMonth, // 1-12
     invoice.year
   );
   ```

3. **Tạo các maps**:
   - `classPriceMap`: `Record<string, number>` - Key: `classId`, Value: `price_per_session`
   - `classSessionCountMap`: `Record<string, number>` - Key: `classId`, Value: `total_sessions`
   - `classTotalAmountMap`: `Record<string, number>` - Key: `classId`, Value: `total_amount`
   - `classDiscountMap`: `Record<string, number>` - Key: `classId`, Value: `discount`

---

## 2. Logic Tạo `classPriceMap`

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 3463-3534

### Step-by-Step:

```typescript
// 1. Khởi tạo map rỗng
const classPriceMap: Record<string, number> = {};

// 2. Nếu có invoiceDetailsData từ phieu_thu_hoc_phi_chi_tiet
if (invoiceDetailsData) {
  // 3. Duyệt qua từng record trong invoiceDetailsData
  Object.values(invoiceDetailsData).forEach((detail: any) => {
    // 4. Lấy classId từ record
    const classId = detail.classId || detail.class_id || "";
    
    // 5. Kiểm tra month/year match
    if (detailMonth !== dbMonth || detailYear !== invoice.year) {
      return; // Skip nếu không match
    }
    
    // 6. Lấy price_per_session
    const priceValue = detail.price_per_session !== undefined 
      ? detail.price_per_session 
      : detail.pricePerSession;
    
    // 7. Convert sang number và lưu vào map
    if (priceValue !== undefined && priceValue !== null) {
      const price = Number(priceValue) || 0;
      if (price > 0) {
        classPriceMap[classId] = price; // Key: classId, Value: price_per_session
      }
    }
  });
}
```

### Ví Dụ:

Giả sử có 2 records trong `phieu_thu_hoc_phi_chi_tiet`:

**Record 1:**
```json
{
  "id": "student1-class1-3-2026",
  "class_id": "class1",
  "price_per_session": 50000,
  "total_sessions": 4,
  "total_amount": 200000
}
```

**Record 2:**
```json
{
  "id": "student1-class2-3-2026",
  "class_id": "class2",
  "price_per_session": 60000,
  "total_sessions": 3,
  "total_amount": 180000
}
```

**Kết quả `classPriceMap`:**
```typescript
{
  "class1": 50000,  // Đơn giá lớp 1: 50,000 đ/buổi
  "class2": 60000   // Đơn giá lớp 2: 60,000 đ/buổi
}
```

---

## 3. Logic Sử Dụng `classPriceMap`

**File:** `components/pages/InvoicePage.tsx`  
**Function:** `generateStudentInvoiceHTML()`  
**Dòng:** 4561-4620

### Flow:

1. **Kiểm tra có `classPriceMap` không**:
   ```typescript
   if (invoiceWithSupabaseData.classPriceMap && invoiceWithSupabaseData.classSessionCountMap) {
     // Có data từ Supabase → Dùng classPriceMap
   } else {
     // Không có → Fallback về invoice.sessions + getUnitPrice()
   }
   ```

2. **Nếu có `classPriceMap`**:
   ```typescript
   // Duyệt qua tất cả classId trong classPriceMap
   Object.keys(invoiceWithSupabaseData.classPriceMap).forEach((classId) => {
     // Lấy giá từ classPriceMap
     const pricePerSession = invoiceWithSupabaseData.classPriceMap[classId] || 0;
     
     // Lấy số buổi từ classSessionCountMap
     const sessionCount = invoiceWithSupabaseData.classSessionCountMap[classId] || 0;
     
     // Lấy thành tiền từ classTotalAmountMap (nếu có)
     const totalPrice = invoiceWithSupabaseData.classTotalAmountMap?.[classId] !== undefined
       ? invoiceWithSupabaseData.classTotalAmountMap[classId]
       : (sessionCount * pricePerSession);
     
     // Tạo classSummary entry
     classSummary[key] = {
       classId,
       className,
       classCode,
       subject,
       sessionCount,
       pricePerSession, // Từ classPriceMap
       totalPrice
     };
   });
   ```

3. **Nếu không có `classPriceMap`**:
   ```typescript
   // Fallback: Build từ invoice.sessions
   invoice.sessions.forEach((session) => {
     const classId = session["Class ID"];
     
     // Ưu tiên: classPriceMap > getUnitPrice()
     let pricePerSession = 0;
     if (invoiceWithSupabaseData?.classPriceMap?.[classId] !== undefined) {
       pricePerSession = invoiceWithSupabaseData.classPriceMap[classId];
     } else {
       // Fallback về getUnitPrice() để lấy từ hoc_phi_rieng, lop_hoc, khoa_hoc
       pricePerSession = getUnitPrice(invoice.studentId, subject, classId, invoice.pricePerSession);
     }
     
     // Build classSummary
   });
   ```

---

## 4. Cấu Trúc Dữ Liệu

### `classPriceMap`:
```typescript
Record<string, number>
// Key: classId (string)
// Value: price_per_session (number)
```

**Ví dụ:**
```typescript
{
  "-OlBhlau...": 50000,  // Lớp Toán: 50,000 đ/buổi
  "-OmCklau...": 60000,  // Lớp Văn: 60,000 đ/buổi
  "-OnDmlau...": 55000   // Lớp Anh: 55,000 đ/buổi
}
```

### `classSessionCountMap`:
```typescript
Record<string, number>
// Key: classId (string)
// Value: total_sessions (number) - Tổng số buổi học
```

**Ví dụ:**
```typescript
{
  "-OlBhlau...": 4,  // Lớp Toán: 4 buổi
  "-OmCklau...": 3,  // Lớp Văn: 3 buổi
  "-OnDmlau...": 5   // Lớp Anh: 5 buổi
}
```

### `classTotalAmountMap`:
```typescript
Record<string, number>
// Key: classId (string)
// Value: total_amount (number) - Tổng thành tiền từ database
```

**Ví dụ:**
```typescript
{
  "-OlBhlau...": 200000,  // Lớp Toán: 200,000 đ
  "-OmCklau...": 180000,  // Lớp Văn: 180,000 đ
  "-OnDmlau...": 275000   // Lớp Anh: 275,000 đ
}
```

---

## 5. Ưu Tiên Lấy Giá

Khi build `classSummary`, thứ tự ưu tiên lấy giá:

1. **`classPriceMap[classId]`** (từ `phieu_thu_hoc_phi_chi_tiet`) - **Ưu tiên cao nhất**
2. **`getUnitPrice()`** (fallback) - Lấy từ:
   - `hoc_phi_rieng` (từ `lop_hoc_hoc_sinh`)
   - `lop_hoc["Học phí mỗi buổi"]`
   - `khoa_hoc.Giá`

---

## 6. Lưu Vào Invoice Object

**File:** `components/pages/InvoicePage.tsx`  
**Dòng:** 3555-3559

```typescript
// Thêm classPriceMap và classSessionCountMap vào invoice object
(updatedInvoice as any).classPriceMap = classPriceMap;
(updatedInvoice as any).classSessionCountMap = classSessionCountMap;
(updatedInvoice as any).classTotalAmountMap = classTotalAmountMap;
(updatedInvoice as any).classDiscountMap = classDiscountMap;
```

**Mục đích:**
- Truyền vào `generateStudentInvoiceHTML()` để build `classSummary`
- Đảm bảo giá hiển thị chính xác từ database

---

## 7. Ví Dụ Hoàn Chỉnh

### Input:
- **Invoice ID**: `student1-3-2026`
- **Student ID**: `student1`
- **Month**: 3 (tháng 3)
- **Year**: 2026

### Step 1: Load từ `phieu_thu_hoc_phi_chi_tiet`

**Query:**
```typescript
supabaseGetByStudentMonthYear(
  "datasheet/Phiếu_thu_học_phí_chi_tiết",
  "student1",
  3, // month 1-12
  2026
)
```

**Kết quả:**
```json
{
  "student1-class1-3-2026": {
    "class_id": "class1",
    "price_per_session": 50000,
    "total_sessions": 4,
    "total_amount": 200000,
    "subject": "Toán"
  },
  "student1-class2-3-2026": {
    "class_id": "class2",
    "price_per_session": 60000,
    "total_sessions": 3,
    "total_amount": 180000,
    "subject": "Văn"
  }
}
```

### Step 2: Tạo Maps

**`classPriceMap`:**
```typescript
{
  "class1": 50000,
  "class2": 60000
}
```

**`classSessionCountMap`:**
```typescript
{
  "class1": 4,
  "class2": 3
}
```

**`classTotalAmountMap`:**
```typescript
{
  "class1": 200000,
  "class2": 180000
}
```

### Step 3: Build `classSummary`

**`classSummary`:**
```typescript
{
  "T12": {  // Key: classCode
    classId: "class1",
    className: "Toán 12",
    classCode: "T12",
    subject: "Toán",
    sessionCount: 4,
    pricePerSession: 50000,  // Từ classPriceMap
    totalPrice: 200000       // Từ classTotalAmountMap
  },
  "V12": {  // Key: classCode
    classId: "class2",
    className: "Văn 12",
    classCode: "V12",
    subject: "Văn",
    sessionCount: 3,
    pricePerSession: 60000,  // Từ classPriceMap
    totalPrice: 180000       // Từ classTotalAmountMap
  }
}
```

### Step 4: Tạo `subjectsForTable`

**`subjectsForTable`:**
```typescript
[
  {
    classId: "class1",
    subject: "Toán",
    className: "Toán 12",
    sessions: 4,
    pricePerSession: 50000,
    total: 200000
  },
  {
    classId: "class2",
    subject: "Văn",
    className: "Văn 12",
    sessions: 3,
    pricePerSession: 60000,
    total: 180000
  }
]
```

### Step 5: Render HTML

**Kết quả hiển thị:**
```
| Môn học | Lớp    | Buổi | Đơn giá  | Thành tiền |
|---------|--------|------|----------|------------|
| Toán    | Toán 12|  4   | 50,000 đ | 200,000 đ  |
| Văn     | Văn 12 |  3   | 60,000 đ | 180,000 đ  |
```

---

## 8. Lưu Ý Quan Trọng

### 1. Nếu Có Nhiều Records Cùng `classId`:

**Ví dụ:**
- Record 1: `class1`, `price_per_session = 50000`
- Record 2: `class1`, `price_per_session = 55000`

**Kết quả:**
- `classPriceMap["class1"] = 55000` (giá cuối cùng ghi đè giá trước)

**⚠️ Lưu ý:** Nếu có nhiều records cùng `classId`, giá cuối cùng sẽ ghi đè. Đảm bảo mỗi `classId` chỉ có 1 record trong tháng.

### 2. Nếu Không Có Data Trong `phieu_thu_hoc_phi_chi_tiet`:

- `classPriceMap` sẽ rỗng `{}`
- Code sẽ fallback về `invoice.sessions` + `getUnitPrice()`
- Vẫn hiển thị được, nhưng giá có thể không chính xác bằng giá trong database

### 3. Month/Year Filter:

- Chỉ lấy records có `month` và `year` match với invoice
- Records khác tháng/năm sẽ bị skip

### 4. `classId` Bắt Buộc:

- Nếu record không có `classId`, sẽ bị skip
- Log warning: `⚠️ Skipping detail: no classId`

---

## 9. Debug Logs

Các log quan trọng để debug:

1. **`📊 Loading invoice details for modal with filters`**: Thông tin filter
2. **`📊 Loaded X records from phieu_thu_hoc_phi_chi_tiet`**: Số records load được
3. **`📊 Processing X invoice details`**: Đang xử lý
4. **`📊 Processing detail X`**: Chi tiết từng record
5. **`✅ Loaded total_amount from phieu_thu_hoc_phi_chi_tiet`**: Đã load thành công
6. **`📊 Final classPriceMap for month X/Y`**: Kết quả cuối cùng
7. **`📋 Building classSummary from Supabase data`**: Đang build từ Supabase
8. **`📋 Building classSummary for class X`**: Chi tiết từng lớp
9. **`📋 Final classSummary`**: Kết quả cuối cùng

---

## 10. Tóm Tắt

**`classPriceMap` là gì?**
- Map lưu `price_per_session` cho từng `classId`
- Key: `classId` (string)
- Value: `price_per_session` (number)

**Khi nào tạo?**
- Khi mở invoice modal (`viewStudentInvoice`)
- Load từ `phieu_thu_hoc_phi_chi_tiet` theo `studentId`, `month`, `year`

**Dùng để làm gì?**
- Build `classSummary` để hiển thị trong phiếu thu
- Đảm bảo giá chính xác từ database (không tính lại)

**Ưu tiên:**
1. `classPriceMap[classId]` (từ database) - **Cao nhất**
2. `getUnitPrice()` (fallback) - Thấp hơn

**Nếu không có:**
- Fallback về `invoice.sessions` + `getUnitPrice()`
- Vẫn hiển thị được, nhưng có thể không chính xác bằng database
