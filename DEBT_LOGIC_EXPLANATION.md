# Logic "Nợ học phí" (Debt) - Giải thích

## Nguồn dữ liệu hiện tại

### 1. Khi tính học phí (`calculateAndSaveInvoices`)

#### A. Invoice chi tiết (`phieu_thu_hoc_phi_chi_tiet`)

**Nguồn debt:**
- **Lấy từ invoice cũ** (nếu có): `existingDebt = existingInvoice.debt || 0`
- **Nếu không có invoice cũ**: `debt = 0`

**Code location:**
```typescript
// Line 4544-4571: Tìm invoice cũ
const existingInvoices = await supabaseGetByStudentMonthYear(
  "datasheet/Phiếu_thu_học_phí_chi_tiết",
  studentId,
  studentMonth,
  studentYear
);

if (existingInvoice) {
  existingDebt = existingInvoice.debt || 0; // Lấy từ invoice cũ
}

// Line 4637: Lưu debt
debt: existingDebt, // Giữ lại debt cũ (sẽ được tính lại sau)
```

**Vấn đề:** Debt không được tính lại tự động, chỉ giữ lại giá trị cũ.

#### B. Invoice tổng hợp (`phieu_thu_hoc_phi`)

**Nguồn debt:**
- **Lấy từ invoice tổng hợp cũ** (nếu có): `existingDebt = existing.debt || 0`
- **Nếu không có invoice cũ**: `debt = 0`

**Code location:**
```typescript
// Line 4819-4828: Tìm invoice tổng hợp cũ
const existingAggregated = await supabaseGetByStudentMonthYear(
  "datasheet/Phiếu_thu_học_phí",
  aggregated.studentId,
  aggregated.month,
  aggregated.year
);

if (existingAggregated) {
  existingDebt = existing.debt || 0; // Lấy từ invoice tổng hợp cũ
}
```

**Vấn đề:** Debt không được tính lại tự động, chỉ giữ lại giá trị cũ.

### 2. Hàm tính debt (`calculateDebtWithDataSource`)

**Location:** Line 2300-2408

**Logic:**
1. Tính tổng các invoice **trước tháng hiện tại** (chưa thanh toán)
2. Chỉ tính các invoice có `status !== "paid"`
3. Cộng dồn `finalAmount` hoặc `totalAmount` của các invoice đó

**Vấn đề:** Hàm này **KHÔNG được gọi** trong `calculateAndSaveInvoices`, nên debt không được tính lại tự động.

## Kết luận

**Hiện tại:**
- Debt được **lấy từ database** (giá trị cũ của invoice)
- Nếu invoice mới → debt = 0
- Debt **KHÔNG được tính lại** từ các invoice trước đó

**Cần cải thiện:**
- Gọi `calculateDebtWithDataSource` trong `calculateAndSaveInvoices` để tính lại debt từ các invoice trước đó
- Hoặc tính debt trực tiếp trong `calculateAndSaveInvoices` dựa trên các invoice chưa thanh toán của tháng trước
