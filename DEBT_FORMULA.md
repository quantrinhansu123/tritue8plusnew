# Công thức tính "Nợ học phí" (Debt)

## Tổng quan

"Nợ học phí" được tính **tự động** khi nhấn nút "Tính học phí" hoặc "Tổng hợp học phí".

## Công thức

### Công thức chung:

```
Nợ học phí = Tổng (finalAmount hoặc totalAmount) của TẤT CẢ các invoice:
  - Của cùng học sinh (student_id)
  - Ở các tháng/năm TRƯỚC tháng hiện tại
  - Có status !== "paid" (chưa thanh toán)
```

### Điều kiện chi tiết:

1. **Cùng học sinh**: `invoice.student_id === current_student_id`
2. **Tháng/năm trước**: 
   - `invoice.year < current_year` HOẶC
   - `invoice.year === current_year && invoice.month < current_month`
3. **Chưa thanh toán**: `invoice.status !== "paid"` (hoặc `status === "unpaid"`)

### Giá trị tính nợ:

- Ưu tiên: `invoice.finalAmount` (thành tiền sau giảm giá)
- Fallback: `invoice.totalAmount` (tổng tiền trước giảm giá)
- Nếu không có: `0`

## Nơi tính debt

### 1. Khi nhấn "Tính học phí" (`calculateAndSaveInvoices`)

**Location:** `components/pages/InvoicePage.tsx` (dòng 4488-4517)

**Bảng tính từ:** `phieu_thu_hoc_phi_chi_tiet` (bảng chi tiết)

**Code:**
```typescript
// Load tất cả invoices chi tiết
const allDetailInvoicesForDebt = await supabaseGetAll("datasheet/Phiếu_thu_học_phí_chi_tiết");

let calculatedDebt = 0;
Object.entries(allDetailInvoicesForDebt).forEach(([id, invoice]) => {
  // Điều kiện 1: Cùng học sinh
  if (invoice.student_id !== studentId) return;
  
  // Điều kiện 2: Tháng/năm trước
  const isBeforeCurrentMonth = invoice.year < studentYear || 
    (invoice.year === studentYear && invoice.month < studentMonth);
  if (!isBeforeCurrentMonth) return;
  
  // Điều kiện 3: Chưa thanh toán
  const status = invoice.status || "unpaid";
  if (status === "paid") return;
  
  // Cộng dồn
  const amount = invoice.finalAmount || invoice.final_amount || 
                 invoice.totalAmount || invoice.total_amount || 0;
  calculatedDebt += amount;
});
```

**Lưu vào:** `phieu_thu_hoc_phi_chi_tiet.debt`

### 2. Khi nhấn "Tổng hợp học phí" (`aggregateInvoicesToMaster`)

**Location:** `components/pages/InvoicePage.tsx` (dòng 4830-4865)

**Bảng tính từ:** `phieu_thu_hoc_phi` (bảng tổng hợp)

**Code:**
```typescript
// Load tất cả invoices tổng hợp
const allAggregatedInvoicesForDebt = await supabaseGetAll("datasheet/Phiếu_thu_học_phí");

let calculatedAggregatedDebt = 0;
Object.entries(allAggregatedInvoicesForDebt).forEach(([id, invoice]) => {
  // Điều kiện 1: Cùng học sinh
  if (invoice.student_id !== aggregated.studentId) return;
  
  // Điều kiện 2: Tháng/năm trước
  const isBeforeCurrentMonth = invoice.year < aggregated.year || 
    (invoice.year === aggregated.year && invoice.month < aggregated.month);
  if (!isBeforeCurrentMonth) return;
  
  // Điều kiện 3: Chưa thanh toán
  const status = invoice.status || "unpaid";
  if (status === "paid") return;
  
  // Cộng dồn
  const amount = invoice.finalAmount || invoice.final_amount || 
                 invoice.totalAmount || invoice.total_amount || 0;
  calculatedAggregatedDebt += amount;
});
```

**Lưu vào:** `phieu_thu_hoc_phi.debt`

## Ví dụ

### Ví dụ 1: Học sinh A

**Invoices:**
- Tháng 1/2026: 500,000 đ (status: unpaid)
- Tháng 2/2026: 600,000 đ (status: unpaid)
- Tháng 3/2026: 700,000 đ (status: unpaid)

**Khi tính invoice tháng 3/2026:**
- Nợ học phí = 500,000 + 600,000 = **1,100,000 đ**
- (Không tính tháng 3 vì là tháng hiện tại)

### Ví dụ 2: Học sinh B

**Invoices:**
- Tháng 1/2026: 500,000 đ (status: **paid**)
- Tháng 2/2026: 600,000 đ (status: unpaid)
- Tháng 3/2026: 700,000 đ (status: unpaid)

**Khi tính invoice tháng 3/2026:**
- Nợ học phí = 600,000 đ
- (Không tính tháng 1 vì đã thanh toán)

### Ví dụ 3: Học sinh C

**Invoices:**
- Tháng 1/2026: 500,000 đ (status: unpaid)
- Tháng 2/2026: 600,000 đ (status: unpaid)
- Tháng 3/2026: 700,000 đ (status: unpaid)

**Khi tính invoice tháng 2/2026:**
- Nợ học phí = 500,000 đ
- (Chỉ tính tháng 1, không tính tháng 2 và 3)

## Lưu ý

1. **Debt được tính tự động** khi nhấn "Tính học phí" hoặc "Tổng hợp học phí"
2. **Debt chỉ tính từ các invoice đã lưu** trong database (không tính từ sessions chưa tạo invoice)
3. **Debt được tính lại** mỗi khi nhấn "Tính học phí" hoặc "Tổng hợp học phí"
4. **Debt chỉ tính từ bảng tương ứng:**
   - Invoice chi tiết → tính từ `phieu_thu_hoc_phi_chi_tiet`
   - Invoice tổng hợp → tính từ `phieu_thu_hoc_phi`

## Công thức toán học

```
debt(current_month, current_year) = Σ {
  invoice.finalAmount | invoice.totalAmount
  WHERE invoice.student_id = current_student_id
    AND (invoice.year < current_year OR 
         (invoice.year = current_year AND invoice.month < current_month))
    AND invoice.status ≠ "paid"
}
```
