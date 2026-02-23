# Hướng dẫn sử dụng bảng PHIẾU_THU_HỌC_PHÍ_CHI_TIẾT

## Tổng quan

Bảng `phieu_thu_hoc_phi_chi_tiet` được tạo để lưu học phí của **từng môn học** cho mỗi học sinh trong tháng. Điều này cho phép một học sinh có nhiều môn học trong cùng 1 tháng, mỗi môn học sẽ có 1 record riêng biệt.

## Cấu trúc bảng

### Bảng chính: `phieu_thu_hoc_phi_chi_tiet`

- **id**: Format `{studentId}-{classId}-{month}-{year}` (ví dụ: `-OgBnlEHOk4DQEkPfRdU--OlBhlau...-1-2024`)
- **student_id**: ID của học sinh
- **student_name**: Tên học sinh (denormalized)
- **student_code**: Mã học sinh (denormalized)
- **class_id**: ID của lớp học (môn học)
- **class_name**: Tên lớp học
- **class_code**: Mã lớp học
- **subject**: Môn học
- **month**: Tháng (1-12)
- **year**: Năm
- **total_sessions**: Tổng số buổi học
- **price_per_session**: Đơn giá mỗi buổi học
- **total_amount**: Tổng tiền (trước giảm giá)
- **discount**: Số tiền giảm giá
- **final_amount**: Thành tiền (sau giảm giá)
- **status**: Trạng thái (`paid` hoặc `unpaid`)
- **sessions**: Danh sách các buổi học (JSONB array)
- **invoice_image**: Base64 image data của phiếu thu
- **debt**: Công nợ từ các tháng trước
- **paid_at**: Thời điểm thanh toán
- **notes**: Ghi chú
- **metadata**: Metadata bổ sung (JSONB)
- **created_at**, **updated_at**: Timestamps

### View tổng hợp: `v_phieu_thu_hoc_phi_tong_hop`

View này tổng hợp tất cả các môn học của 1 học sinh trong 1 tháng:

- **student_id**, **student_name**, **student_code**
- **month**, **year**
- **so_mon_hoc**: Số môn học
- **tong_so_buoi_hoc**: Tổng số buổi học
- **tong_tien**: Tổng tiền (trước giảm giá)
- **tong_giam_gia**: Tổng giảm giá
- **tong_thanh_tien**: Tổng thành tiền (sau giảm giá)
- **tong_da_thanh_toan**: Tổng đã thanh toán
- **tong_chua_thanh_toan**: Tổng chưa thanh toán
- **status**: `paid` nếu tất cả đã thanh toán, `unpaid` nếu còn ít nhất 1 môn chưa thanh toán

## Các bước thiết lập

### 1. Tạo bảng

```bash
npm run sql:run scripts/create_phieu_thu_hoc_phi_chi_tiet_table.sql
```

### 2. Migrate dữ liệu từ bảng cũ (nếu có)

```bash
npm run sql:run scripts/migrate_phieu_thu_hoc_phi_to_chi_tiet.sql
```

### 3. Cập nhật code để sử dụng bảng mới

Trong `InvoicePage.tsx`, cần cập nhật để load data từ bảng mới:

```typescript
// Thay vì:
const invoicesData = await supabaseGetAll("datasheet/Phiếu_thu_học_phí");

// Sử dụng:
const invoicesData = await supabaseGetAll("datasheet/Phiếu_thu_học_phí_chi_tiết");
```

## Ví dụ sử dụng

### Query tất cả các môn học của 1 học sinh trong 1 tháng

```sql
SELECT * 
FROM phieu_thu_hoc_phi_chi_tiet
WHERE student_id = '-OgBnlEHOk4DQEkPfRdU'
  AND month = 1
  AND year = 2024;
```

### Query tổng hợp học phí của 1 học sinh trong 1 tháng

```sql
SELECT * 
FROM v_phieu_thu_hoc_phi_tong_hop
WHERE student_id = '-OgBnlEHOk4DQEkPfRdU'
  AND month = 1
  AND year = 2024;
```

### Query tất cả học sinh chưa thanh toán trong tháng

```sql
SELECT * 
FROM v_phieu_thu_hoc_phi_tong_hop
WHERE month = 1
  AND year = 2024
  AND status = 'unpaid';
```

## Lưu ý

1. **ID format**: ID của record phải theo format `{studentId}-{classId}-{month}-{year}` để đảm bảo unique constraint.

2. **Month conversion**: 
   - Database lưu month từ 1-12
   - JavaScript/Firebase sử dụng month từ 0-11
   - Hàm `convertToSupabaseFormat` và `convertFromSupabaseFormat` đã tự động convert

3. **Bảng cũ**: Bảng `phieu_thu_hoc_phi` vẫn được giữ lại để tương thích ngược, nhưng nên chuyển sang sử dụng bảng mới.

4. **Real-time**: Bảng mới đã được bật Realtime, nên có thể subscribe để cập nhật real-time.
