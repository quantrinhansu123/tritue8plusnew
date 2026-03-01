# Kiểm Tra Các Cột Được Điền Trong `phieu_thu_hoc_phi_chi_tiet`

## Tổng Quan

Khi điểm danh và tự động sync invoices, function `syncInvoicesForCurrentSession` sẽ tạo/cập nhật records trong bảng `phieu_thu_hoc_phi_chi_tiet`. Tài liệu này so sánh các cột trong schema với những gì được điền thực tế.

---

## Schema Bảng `phieu_thu_hoc_phi_chi_tiet`

Theo `scripts/create_phieu_thu_hoc_phi_chi_tiet_table.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.phieu_thu_hoc_phi_chi_tiet (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name TEXT,
    student_code TEXT,
    class_id TEXT NOT NULL,
    class_name TEXT,
    class_code TEXT,
    subject TEXT,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    total_sessions INTEGER DEFAULT 0,
    price_per_session NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) DEFAULT 0,
    discount NUMERIC(12, 2) DEFAULT 0,
    final_amount NUMERIC(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
    sessions JSONB DEFAULT '[]'::JSONB,
    invoice_image TEXT,
    debt NUMERIC(12, 2) DEFAULT 0,
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Các Cột Được Điền Trong `syncInvoicesForCurrentSession`

**File:** `components/pages/AttendanceSession.tsx`  
**Dòng:** 395-414 (tạo invoice mới)

### ✅ Các cột ĐƯỢC điền:

1. **`id`** ✅
   - Format: `{studentId}-{classId}-{month}-{year}`
   - Code: `id: key`

2. **`student_id`** ✅
   - Code: `studentId`

3. **`student_name`** ✅
   - Code: `studentName: student?.["Họ và tên"] || record["Tên học sinh"] || ""`

4. **`student_code`** ✅
   - Code: `studentCode: student?.["Mã học sinh"] || ""`

5. **`class_id`** ✅
   - Code: `classId: currentClassId`

6. **`class_name`** ✅
   - Code: `className: classInfo?.["Tên lớp"] || ""`

7. **`class_code`** ✅
   - Code: `classCode: classInfo?.["Mã lớp"] || ""`
   - ⚠️ **Lưu ý**: Trong `convertToSupabaseFormat`, cột này bị xóa (dòng 981-982 trong `supabaseHelpers.ts`)

8. **`subject`** ✅
   - Code: `subject: classInfo?.["Môn học"] || ""`

9. **`month`** ✅
   - Code: `month: targetMonth + 1` (convert từ 0-11 sang 1-12)

10. **`year`** ✅
    - Code: `year: targetYear`

11. **`total_sessions`** ✅
    - Code: `totalSessions: 1` (hoặc tăng lên nếu update)

12. **`price_per_session`** ✅
    - Code: `pricePerSession: pricePerSession`

13. **`total_amount`** ✅
    - Code: `totalAmount: pricePerSession` (hoặc tính lại nếu update)

14. **`discount`** ✅
    - Code: `discount: 0` (hoặc giữ nguyên nếu update)

15. **`final_amount`** ✅
    - Code: `finalAmount: pricePerSession` (hoặc tính lại nếu update)
    - ⚠️ **Lưu ý**: Trong `convertToSupabaseFormat`, có comment "Bỏ cột này vì không tồn tại" (dòng 966), nhưng thực tế cột này CÓ trong schema

16. **`status`** ✅
    - Code: `status: "unpaid"` (hoặc giữ nguyên nếu update)

17. **`sessions`** ✅
    - Code: `sessions: [sessionInfo]` (JSONB array)

18. **`debt`** ✅
    - Code: `debt: debt` (tính từ các invoice chưa thanh toán trước đó)

---

## ❌ Các Cột KHÔNG ĐƯỢC điền (có DEFAULT hoặc NULL):

1. **`invoice_image`** ❌
   - **Không được điền** trong `syncInvoicesForCurrentSession`
   - **Default**: `NULL`
   - **Khi nào điền**: Khi in phiếu thu và lưu ảnh

2. **`paid_at`** ❌
   - **Không được điền** trong `syncInvoicesForCurrentSession`
   - **Default**: `NULL`
   - **Khi nào điền**: Khi đánh dấu invoice là "paid"

3. **`notes`** ❌
   - **Không được điền** trong `syncInvoicesForCurrentSession`
   - **Default**: `NULL`
   - **Khi nào điền**: Khi user thêm ghi chú thủ công

4. **`metadata`** ❌
   - **Không được điền** trong `syncInvoicesForCurrentSession`
   - **Default**: `'{}'::JSONB`
   - **Khi nào điền**: Khi cần lưu thông tin bổ sung

5. **`created_at`** ✅ (Tự động)
   - **Tự động điền** bởi database: `DEFAULT NOW()`

6. **`updated_at`** ✅ (Tự động)
   - **Tự động điền** bởi trigger: `BEFORE UPDATE`

---

## ⚠️ Vấn Đề Với `convertToSupabaseFormat`

**File:** `utils/supabaseHelpers.ts`  
**Dòng:** 956-988

### Vấn đề 1: `class_code` bị xóa

```typescript
// Xóa class_code và classCode khỏi data trước khi lưu (không điền vào database nữa)
if (converted.class_code !== undefined) delete converted.class_code;
if (converted.classCode !== undefined) delete converted.classCode;
```

**Nhưng**: Cột `class_code` **CÓ** trong schema (dòng 15 trong SQL).

**Giải pháp**: Nên điền `class_code` vào database.

### Vấn đề 2: `final_amount` bị comment

```typescript
// finalAmount: "final_amount", // Bỏ cột này vì không tồn tại trong phieu_thu_hoc_phi_chi_tiet
```

**Nhưng**: Cột `final_amount` **CÓ** trong schema (dòng 23 trong SQL).

**Giải pháp**: Nên điền `final_amount` vào database.

---

## Tóm Tắt

### ✅ Điền đầy đủ (18/23 cột):
- `id`, `student_id`, `student_name`, `student_code`
- `class_id`, `class_name`, `subject`
- `month`, `year`
- `total_sessions`, `price_per_session`, `total_amount`, `discount`, `final_amount`
- `status`, `sessions`, `debt`
- `created_at`, `updated_at` (tự động)

### ❌ Không điền (5 cột - có DEFAULT hoặc NULL):
- `invoice_image` - Chỉ điền khi in phiếu
- `paid_at` - Chỉ điền khi thanh toán
- `notes` - Chỉ điền khi user thêm ghi chú
- `metadata` - Chỉ điền khi cần thông tin bổ sung
- `class_code` - ⚠️ **BỊ XÓA** trong `convertToSupabaseFormat` (nên điền)

---

## Khuyến Nghị

1. **Điền `class_code`**: 
   - Bỏ phần xóa `class_code` trong `convertToSupabaseFormat`
   - Thêm mapping: `classCode: "class_code"`

2. **Điền `final_amount`**:
   - Bỏ comment trong `convertToSupabaseFormat`
   - Thêm mapping: `finalAmount: "final_amount"`

3. **Các cột còn lại** (`invoice_image`, `paid_at`, `notes`, `metadata`):
   - Không cần điền trong `syncInvoicesForCurrentSession`
   - Sẽ được điền khi cần thiết (in phiếu, thanh toán, ghi chú)

---

## Kết Luận

**Trả lời câu hỏi**: Tự động sync invoices **CÓ điền đầy đủ** các cột cần thiết, **TRỪ**:
- `class_code` - Bị xóa trong `convertToSupabaseFormat` (nên sửa)
- `final_amount` - Bị comment trong `convertToSupabaseFormat` (nên sửa)
- `invoice_image`, `paid_at`, `notes`, `metadata` - Không cần điền lúc sync (sẽ điền sau khi cần)

**Tổng kết**: **18/23 cột được điền** (78%), **5 cột không điền** (22% - trong đó 2 cột nên sửa, 3 cột không cần điền lúc sync).
