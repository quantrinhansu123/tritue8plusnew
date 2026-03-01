# Auto Tạo `classPriceMap` Sau Khi Điểm Danh

## Tổng Quan

Sau khi điểm danh, hệ thống sẽ **tự động tạo invoice với giá từ `hoc_phi_rieng`** ngay từ đầu, thay vì tạo với giá mặc định rồi cập nhật sau. Điều này đảm bảo `price_per_session` trong `phieu_thu_hoc_phi_chi_tiet` luôn chính xác và `classPriceMap` sẽ được tạo đúng khi xem invoice.

---

## 1. Flow Sau Khi Điểm Danh

**File:** `components/pages/AttendanceSession.tsx`  
**Function:** `handleCompleteSession()` → `syncInvoicesForCurrentSession()`

### Step-by-Step:

1. **Lưu attendance vào `diem_danh_sessions`**
2. **Tự động sync invoices** → `syncInvoicesForCurrentSession()`
3. **Tự động cập nhật giá từ `hoc_phi_rieng`** → `updateInvoicePricesFromHocPhiRieng()` (backup, đảm bảo tính nhất quán)

---

## 2. Logic Mới: Lấy Giá Từ `hoc_phi_rieng` Ngay Từ Đầu

**File:** `components/pages/AttendanceSession.tsx`  
**Function:** `syncInvoicesForCurrentSession()`  
**Dòng:** 184-280

### Step 1: Load Data

```typescript
const [studentsData, classesData, invoicesData, tuitionData] = await Promise.all([
  supabaseGetAll("datasheet/Học_sinh"),
  supabaseGetAll("datasheet/Lớp_học"),
  supabaseGetAll("datasheet/Phiếu_thu_học_phí_chi_tiết"),
  supabaseGetAll("datasheet/Lớp_học/Học_sinh"), // ✅ Load hoc_phi_rieng
]);
```

### Step 2: Tạo `hocPhiRiengMap`

```typescript
// Tạo map để lookup nhanh: key = "student_id-class_id", value = hoc_phi_rieng
const hocPhiRiengMap = new Map<string, number>();
if (tuitionData && typeof tuitionData === "object") {
  Object.values(tuitionData).forEach((item: any) => {
    const studentId = item.studentId || item.student_id || "";
    const classId = item.classId || item.class_id || "";
    const rawHocPhiRieng = item.hocPhiRieng ?? item.hoc_phi_rieng;
    const hocPhiRieng = rawHocPhiRieng !== null && rawHocPhiRieng !== undefined
      ? Number(rawHocPhiRieng)
      : null;

    if (studentId && classId && hocPhiRieng !== null && !Number.isNaN(hocPhiRieng)) {
      const key = `${studentId}-${classId}`;
      hocPhiRiengMap.set(key, hocPhiRieng);
    }
  });
}
```

**Ví dụ `hocPhiRiengMap`:**
```typescript
Map {
  "student1-class1" => 50000,
  "student1-class2" => 60000,
  "student2-class1" => 55000
}
```

### Step 3: Tạo Helper Function `getPricePerSession()`

```typescript
// Helper function to get price for a specific student and class
// Priority: hoc_phi_rieng > course?.Giá > classInfo?.["Học phí mỗi buổi"]
const getPricePerSession = (studentId: string, classId: string): number => {
  // Priority 1: Lấy từ hoc_phi_rieng
  const mapKey = `${studentId}-${classId}`;
  const hocPhiRieng = hocPhiRiengMap.get(mapKey);
  if (hocPhiRieng !== undefined && hocPhiRieng !== null && hocPhiRieng > 0) {
    return hocPhiRieng;
  }
  // Priority 2: Fallback về default price
  return defaultPricePerSession;
};
```

**Ưu tiên:**
1. **`hoc_phi_rieng`** (từ `lop_hoc_hoc_sinh`) - **Cao nhất**
2. **`course?.Giá`** (từ `khoa_hoc`) - Thấp hơn
3. **`classInfo?.["Học phí mỗi buổi"]`** (từ `lop_hoc`) - Thấp nhất

---

## 3. Sử Dụng `getPricePerSession()` Khi Tạo Invoice

### 3.1. Tạo Invoice Mới

**Dòng:** 417-447

```typescript
// Lấy giá từ hoc_phi_rieng ngay từ đầu
const pricePerSessionForStudent = getPricePerSession(studentId, currentClassId);

const newInvoice = {
  id: key,
  studentId,
  studentName: student?.["Họ và tên"] || record["Tên học sinh"] || "",
  studentCode: student?.["Mã học sinh"] || "",
  classId: currentClassId,
  className: classInfo?.["Tên lớp"] || "",
  classCode: classInfo?.["Mã lớp"] || "",
  subject: classInfo?.["Môn học"] || "",
  month: targetMonth + 1,
  year: targetYear,
  totalSessions: 1,
  pricePerSession: pricePerSessionForStudent, // ✅ Từ hoc_phi_rieng
  totalAmount: pricePerSessionForStudent,
  discount: 0,
  finalAmount: pricePerSessionForStudent,
  status: "unpaid",
  sessions: [sessionInfo],
  debt: debt,
};
```

### 3.2. Cập Nhật Invoice Đã Tồn Tại

**Dòng:** 393-415

```typescript
// Lấy giá từ hoc_phi_rieng hoặc giữ nguyên giá cũ nếu có
const currentPrice = existing.pricePerSession || getPricePerSession(studentId, currentClassId);

const updatedInvoice = {
  id: key,
  // ... other fields
  totalSessions: (existing.totalSessions || 0) + 1,
  pricePerSession: currentPrice, // ✅ Từ hoc_phi_rieng hoặc giữ nguyên
  totalAmount: (existing.totalAmount || 0) + currentPrice,
  // ... other fields
};
```

**Lưu ý:** Nếu invoice đã có `pricePerSession`, giữ nguyên. Nếu chưa có, lấy từ `hoc_phi_rieng`.

### 3.3. Tạo Invoice Bổ Sung (Extra Invoice)

**Dòng:** 359-381

```typescript
// Lấy giá từ hoc_phi_rieng ngay từ đầu
const pricePerSessionForStudent = getPricePerSession(studentId, currentClassId);

const newExtraInvoice = {
  id: extraKey,
  // ... other fields
  pricePerSession: pricePerSessionForStudent, // ✅ Từ hoc_phi_rieng
  totalAmount: pricePerSessionForStudent,
  // ... other fields
};
```

---

## 4. Kết Quả

### 4.1. Invoice Được Tạo Với Giá Chính Xác

**Trước (Logic Cũ):**
```typescript
// Tạo với giá mặc định
pricePerSession: course?.Giá || classInfo?.["Học phí mỗi buổi"] || 0

// Sau đó mới cập nhật từ hoc_phi_rieng
await updateInvoicePricesFromHocPhiRieng(targetMonth + 1, targetYear);
```

**Sau (Logic Mới):**
```typescript
// Tạo với giá từ hoc_phi_rieng ngay từ đầu
pricePerSession: getPricePerSession(studentId, currentClassId)
// → Lấy từ hoc_phi_rieng nếu có, fallback về default
```

### 4.2. `phieu_thu_hoc_phi_chi_tiet` Có `price_per_session` Chính Xác

**Ví dụ:**

**Record trong `phieu_thu_hoc_phi_chi_tiet`:**
```json
{
  "id": "student1-class1-3-2026",
  "student_id": "student1",
  "class_id": "class1",
  "price_per_session": 50000,  // ✅ Từ hoc_phi_rieng
  "total_sessions": 4,
  "total_amount": 200000,
  "month": 3,
  "year": 2026
}
```

### 4.3. `classPriceMap` Được Tạo Đúng Khi Xem Invoice

**File:** `components/pages/InvoicePage.tsx`  
**Function:** `viewStudentInvoice()` → `generateStudentInvoiceHTML()`

Khi xem invoice, `classPriceMap` sẽ được tạo từ `phieu_thu_hoc_phi_chi_tiet`:

```typescript
// Load từ phieu_thu_hoc_phi_chi_tiet
invoiceDetailsData = await supabaseGetByStudentMonthYear(
  "datasheet/Phiếu_thu_học_phí_chi_tiết",
  invoice.studentId,
  dbMonth,
  invoice.year
);

// Tạo classPriceMap
Object.values(invoiceDetailsData).forEach((detail: any) => {
  const classId = detail.classId || detail.class_id || "";
  const priceValue = detail.price_per_session; // ✅ Đã có giá chính xác từ khi tạo invoice
  if (priceValue !== undefined && priceValue !== null) {
    const price = Number(priceValue) || 0;
    if (price > 0) {
      classPriceMap[classId] = price;
    }
  }
});
```

**Kết quả `classPriceMap`:**
```typescript
{
  "class1": 50000,  // ✅ Giá chính xác từ hoc_phi_rieng
  "class2": 60000   // ✅ Giá chính xác từ hoc_phi_rieng
}
```

---

## 5. So Sánh Logic Cũ vs Mới

### Logic Cũ:

1. **Tạo invoice** với giá mặc định (`course?.Giá || classInfo?.["Học phí mỗi buổi"]`)
2. **Sau đó cập nhật** giá từ `hoc_phi_rieng` → `updateInvoicePricesFromHocPhiRieng()`
3. **Vấn đề:** Có thể có delay hoặc lỗi khi cập nhật, dẫn đến giá không chính xác

### Logic Mới:

1. **Load `hoc_phi_rieng`** từ `lop_hoc_hoc_sinh` trước
2. **Tạo map** `hocPhiRiengMap` để lookup nhanh
3. **Tạo invoice** với giá từ `hoc_phi_rieng` ngay từ đầu
4. **Backup:** Vẫn gọi `updateInvoicePricesFromHocPhiRieng()` để đảm bảo tính nhất quán

**Ưu điểm:**
- ✅ Giá chính xác ngay từ đầu
- ✅ Không cần cập nhật lại
- ✅ `classPriceMap` luôn đúng khi xem invoice
- ✅ Hiệu suất tốt hơn (ít query hơn)

---

## 6. Backup: `updateInvoicePricesFromHocPhiRieng()`

**File:** `components/pages/AttendanceSession.tsx`  
**Function:** `updateInvoicePricesFromHocPhiRieng()`  
**Dòng:** 479-577

Function này vẫn được giữ lại và gọi sau khi sync invoice để:

1. **Đảm bảo tính nhất quán:** Cập nhật lại giá cho các invoice đã tồn tại nếu `hoc_phi_rieng` thay đổi
2. **Xử lý edge cases:** Nếu có invoice nào đó không được tạo với giá đúng (do lỗi hoặc logic cũ)

**Khi nào được gọi:**
```typescript
// Sau khi sync invoices
await syncInvoicesForCurrentSession(targetMonth, targetYear, currentClassId, currentAttendanceRecords);

// Auto-update prices from hoc_phi_rieng after syncing invoices (backup)
await updateInvoicePricesFromHocPhiRieng(targetMonth + 1, targetYear);
```

---

## 7. Ví Dụ Hoàn Chỉnh

### Input:
- **Student ID**: `student1`
- **Class ID**: `class1`
- **Month**: 3 (tháng 3)
- **Year**: 2026
- **`hoc_phi_rieng`** trong `lop_hoc_hoc_sinh`: `50000`

### Step 1: Load Data

```typescript
tuitionData = {
  "enrollment1": {
    "student_id": "student1",
    "class_id": "class1",
    "hoc_phi_rieng": 50000
  }
}
```

### Step 2: Tạo Map

```typescript
hocPhiRiengMap = Map {
  "student1-class1" => 50000
}
```

### Step 3: Tạo Invoice

```typescript
pricePerSessionForStudent = getPricePerSession("student1", "class1");
// → 50000 (từ hoc_phi_rieng)

newInvoice = {
  id: "student1-class1-3-2026",
  studentId: "student1",
  classId: "class1",
  pricePerSession: 50000, // ✅ Từ hoc_phi_rieng
  totalSessions: 1,
  totalAmount: 50000,
  month: 3,
  year: 2026
}
```

### Step 4: Lưu Vào Database

```sql
INSERT INTO phieu_thu_hoc_phi_chi_tiet (
  id,
  student_id,
  class_id,
  price_per_session,  -- ✅ 50000 (từ hoc_phi_rieng)
  total_sessions,
  total_amount,
  month,
  year
) VALUES (
  'student1-class1-3-2026',
  'student1',
  'class1',
  50000,
  1,
  50000,
  3,
  2026
);
```

### Step 5: Xem Invoice → Tạo `classPriceMap`

```typescript
// Load từ phieu_thu_hoc_phi_chi_tiet
invoiceDetailsData = {
  "student1-class1-3-2026": {
    "class_id": "class1",
    "price_per_session": 50000  // ✅ Đã có giá chính xác
  }
}

// Tạo classPriceMap
classPriceMap = {
  "class1": 50000  // ✅ Giá chính xác
}
```

---

## 8. Lưu Ý Quan Trọng

### 1. Nếu Không Có `hoc_phi_rieng`:

- Fallback về `course?.Giá || classInfo?.["Học phí mỗi buổi"]`
- Vẫn tạo invoice được, nhưng giá có thể không chính xác bằng giá riêng

### 2. Nếu Có Nhiều Records Cùng `student_id-class_id`:

- Map sẽ lấy giá cuối cùng (ghi đè)
- Đảm bảo mỗi `student_id-class_id` chỉ có 1 record trong `lop_hoc_hoc_sinh`

### 3. Invoice Đã Có Giá:

- Nếu invoice đã có `pricePerSession`, giữ nguyên
- Chỉ lấy từ `hoc_phi_rieng` nếu invoice chưa có giá

### 4. Backup Function:

- `updateInvoicePricesFromHocPhiRieng()` vẫn được gọi sau khi sync
- Đảm bảo tính nhất quán và xử lý edge cases

---

## 9. Tóm Tắt

**Thay đổi chính:**
- ✅ Load `hoc_phi_rieng` từ `lop_hoc_hoc_sinh` trước khi tạo invoice
- ✅ Tạo map `hocPhiRiengMap` để lookup nhanh
- ✅ Tạo helper function `getPricePerSession()` với priority: `hoc_phi_rieng` > `course?.Giá` > `classInfo?.["Học phí mỗi buổi"]`
- ✅ Tạo invoice với giá từ `hoc_phi_rieng` ngay từ đầu
- ✅ `classPriceMap` sẽ được tạo đúng khi xem invoice

**Kết quả:**
- ✅ `price_per_session` trong `phieu_thu_hoc_phi_chi_tiet` luôn chính xác
- ✅ `classPriceMap` luôn đúng khi xem invoice
- ✅ Hiệu suất tốt hơn (ít query hơn)
- ✅ Không cần cập nhật lại giá sau khi tạo invoice
