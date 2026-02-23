# Logic Tính Lại Học Phí

## Tổng Quan

Khi nhấn nút **"Tính học phí"**, hệ thống sẽ:
1. Lọc sessions theo tháng/năm đã chọn
2. Group sessions theo học sinh + lớp
3. Tính giá mỗi buổi cho từng học sinh-lớp
4. Tính tổng số buổi và tổng tiền
5. Lưu vào Supabase bảng `phieu_thu_hoc_phi_chi_tiet`

## Chi Tiết Logic

### 1. Lọc Sessions (Dòng 3930-3976)

```typescript
sessions.forEach((session) => {
  // Chỉ xử lý sessions có ngày và điểm danh
  if (!session["Ngày"] || !session["Điểm danh"]) return;
  
  // Convert session month (0-11) sang 1-12 để so sánh
  const sessionDate = new Date(session["Ngày"]);
  const sMonth = sessionDate.getMonth() + 1; // 1-12
  const sYear = sessionDate.getFullYear();
  
  // Chỉ xử lý sessions match với tháng/năm đã chọn
  if (sMonth !== studentMonth || sYear !== studentYear) return;
  
  // Xử lý từng record điểm danh
  attendanceRecords.forEach((record) => {
    const studentId = record["Student ID"];
    const isPresent = record["Có mặt"] === true;
    
    // Chỉ tính cho học sinh có mặt
    if (!studentId || !isPresent) return;
    
    // Group sessions theo key: "studentId-classId"
    const mapKey = `${studentId}-${classId}`;
  });
});
```

**Điều kiện:**
- Session phải có `Ngày` và `Điểm danh`
- Session phải thuộc tháng/năm đã chọn
- Học sinh phải có mặt (`Có mặt === true`)

### 2. Group Sessions (Dòng 3956-3974)

**Key để group:** `studentId-classId`

Mỗi nhóm chứa:
- `studentId`: ID học sinh
- `classId`: ID lớp
- `className`: Tên lớp
- `classCode`: Mã lớp
- `subject`: Môn học
- `sessions[]`: Danh sách các buổi học

**Lưu ý:** Mỗi session chỉ được thêm 1 lần (check duplicate bằng `session.id`)

### 3. Tính Giá Mỗi Buổi - `getUnitPrice()` (Dòng 885-919)

**Ưu tiên (theo thứ tự):**

#### Priority 1: Học phí riêng (`hoc_phi_rieng`)
```typescript
const hocPhiRieng = getHocPhiRieng(student, classId);
if (hocPhiRieng !== null) {
  return hocPhiRieng; // Dùng học phí riêng
}
```

**Cách lấy:**
- Key: `"Mã học sinh-Mã lớp"` (ví dụ: "HS001-LOP01")
- Từ bảng `tuitionFees` (được load từ Firebase/Supabase)
- Nếu có → dùng giá này (ưu tiên cao nhất)

#### Priority 2: Giá từ invoice (nếu có)
```typescript
if (pricePerSession) {
  return pricePerSession; // Dùng giá từ invoice
}
```

#### Priority 3: Giá từ lớp/course
```typescript
// Tìm course match với lớp (cùng Khối và Môn học)
const course = courses.find((c) => {
  if (c.Khối !== classInfo.Khối) return false;
  // Match subject...
});

// Ưu tiên: classInfo["Học phí mỗi buổi"] > course.Giá
return classInfo?.["Học phí mỗi buổi"] || course?.Giá || 0;
```

**Thứ tự ưu tiên:**
1. `classInfo["Học phí mỗi buổi"]` (từ bảng Lớp học)
2. `course.Giá` (từ bảng Khóa học)
3. `0` (nếu không tìm thấy)

### 4. Tính Tổng Số Buổi và Tổng Tiền (Dòng 4006-4009)

```typescript
// Tổng số buổi = số lượng sessions trong nhóm
const totalSessions = studentSessions.length;

// Tổng tiền = số buổi × giá mỗi buổi
const totalAmount = totalSessions * pricePerSession;

// Thành tiền = Tổng tiền (chưa có discount)
const finalAmount = totalAmount;
```

**Công thức:**
- `totalSessions` = `studentSessions.length`
- `totalAmount` = `totalSessions × pricePerSession`
- `finalAmount` = `totalAmount` (chưa trừ discount)

### 5. Tạo Invoice Data (Dòng 4012-4036)

```typescript
const invoiceData = {
  id: `${studentId}-${classId}-${studentMonth}-${studentYear}-${Date.now()}`,
  student_id: studentId,
  student_name: student["Họ và tên"],
  student_code: student["Mã học sinh"],
  class_id: classId,
  class_name: className,
  class_code: classCode,
  subject: subject,
  month: studentMonth, // 1-12
  year: studentYear,
  total_sessions: totalSessions,
  total_amount: totalAmount,
  final_amount: finalAmount,
  price_per_session: pricePerSession,
  discount: 0, // Mặc định = 0
  debt: 0, // Mặc định = 0
  status: "unpaid", // Mặc định = "unpaid"
  sessions: [...], // Danh sách sessions
};
```

### 6. Lưu Vào Supabase (Dòng 4039-4055)

```typescript
const success = await supabaseSet(
  "datasheet/Phiếu_thu_học_phí_chi_tiết",
  invoiceData,
  {
    upsert: true,
    onConflict: "student_id,class_id,month,year", // Update nếu đã tồn tại
  }
);
```

**Lưu ý:**
- **Upsert:** Nếu đã có invoice với cùng `student_id`, `class_id`, `month`, `year` → Update
- **Conflict key:** `student_id,class_id,month,year`
- Mỗi học sinh-lớp-tháng-năm = 1 record trong bảng chi tiết

### 7. Reload Data (Dòng 4061)

```typescript
setRefreshTrigger(prev => prev + 1);
```

Trigger reload để hiển thị data mới sau khi lưu.

## Ví Dụ Cụ Thể

### Ví dụ 1: Học sinh có học phí riêng

**Input:**
- Học sinh: "Nguyễn Văn A" (HS001)
- Lớp: "Lớp Toán 6A" (LOP01)
- Tháng: 2, Năm: 2026
- Sessions: 8 buổi có mặt

**Tính toán:**
1. Tìm học phí riêng: `tuitionFees["HS001-LOP01"]` = 150,000 đ/buổi
2. `pricePerSession` = 150,000 đ
3. `totalSessions` = 8 buổi
4. `totalAmount` = 8 × 150,000 = 1,200,000 đ
5. `finalAmount` = 1,200,000 đ

**Output:**
- Lưu vào Supabase với `price_per_session` = 150,000 đ

### Ví dụ 2: Học sinh không có học phí riêng

**Input:**
- Học sinh: "Trần Thị B" (HS002)
- Lớp: "Lớp Toán 6A" (LOP01)
- Tháng: 2, Năm: 2026
- Sessions: 8 buổi có mặt
- `classInfo["Học phí mỗi buổi"]` = 120,000 đ

**Tính toán:**
1. Không có học phí riêng → dùng giá từ lớp
2. `pricePerSession` = 120,000 đ
3. `totalSessions` = 8 buổi
4. `totalAmount` = 8 × 120,000 = 960,000 đ
5. `finalAmount` = 960,000 đ

**Output:**
- Lưu vào Supabase với `price_per_session` = 120,000 đ

### Ví dụ 3: Học sinh có nhiều lớp trong cùng tháng

**Input:**
- Học sinh: "Lê Văn C" (HS003)
- Lớp 1: "Lớp Toán 6A" (LOP01) - 8 buổi
- Lớp 2: "Lớp Văn 6B" (LOP02) - 6 buổi
- Tháng: 2, Năm: 2026

**Tính toán:**
- **Invoice 1:** HS003-LOP01-2-2026
  - `totalSessions` = 8
  - `totalAmount` = 8 × pricePerSession1
- **Invoice 2:** HS003-LOP02-2-2026
  - `totalSessions` = 6
  - `totalAmount` = 6 × pricePerSession2

**Output:**
- Lưu 2 records riêng biệt vào Supabase (mỗi lớp = 1 record)

## Điều Kiện Bỏ Qua

Hệ thống sẽ **bỏ qua** (không tính) nếu:
1. Session không có `Ngày` hoặc `Điểm danh`
2. Session không thuộc tháng/năm đã chọn
3. Học sinh không có mặt (`Có mặt !== true`)
4. Không tìm thấy học sinh trong danh sách
5. Không tìm thấy lớp trong danh sách
6. `pricePerSession === 0` (không có giá)

## Lưu Ý Quan Trọng

### 1. Format Month
- **Session month:** 0-11 (JavaScript Date)
- **Convert:** `sessionDate.getMonth() + 1` → 1-12
- **Database month:** 1-12
- **So sánh:** `sMonth !== studentMonth` (cả hai đều 1-12)

### 2. Group Key
- **Key:** `studentId-classId`
- Mỗi học sinh-lớp = 1 nhóm
- Nếu học sinh học nhiều lớp → nhiều nhóm riêng biệt

### 3. Upsert Logic
- **Conflict key:** `student_id,class_id,month,year`
- Nếu đã có invoice → **Update** (không tạo mới)
- Đảm bảo không duplicate

### 4. Discount và Debt
- **Mặc định:** `discount = 0`, `debt = 0`
- Có thể chỉnh sửa sau khi tính xong

### 5. Status
- **Mặc định:** `status = "unpaid"`
- Có thể đánh dấu "paid" sau

## Flow Diagram

```
User clicks "Tính học phí"
    ↓
Filter sessions by month/year
    ↓
Group by studentId-classId
    ↓
For each group:
    ↓
    Get pricePerSession (Priority: hoc_phi_rieng > invoice > class/course)
    ↓
    Calculate totalSessions = sessions.length
    ↓
    Calculate totalAmount = totalSessions × pricePerSession
    ↓
    Create invoiceData
    ↓
    Save to Supabase (upsert)
    ↓
Trigger reload
```

## Kết Quả

Sau khi tính xong:
- Tất cả invoices được lưu vào Supabase bảng `phieu_thu_hoc_phi_chi_tiet`
- Mỗi học sinh-lớp-tháng-năm = 1 record
- Data tự động reload và hiển thị trong bảng
- Có thể xem, chỉnh sửa, đánh dấu thanh toán sau
