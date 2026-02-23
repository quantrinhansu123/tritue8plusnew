# Hướng dẫn sử dụng Script tính lại Nợ học phí

## 📋 Tổng quan

Có 2 script SQL để tính lại và cập nhật nợ học phí vào database:

1. **`recalculate_debt_for_all_invoices.sql`** - Tính lại nợ cho TẤT CẢ các phiếu thu
2. **`recalculate_debt_for_student.sql`** - Tính lại nợ cho một học sinh cụ thể

## 🔧 Cách sử dụng

### Script 1: Tính lại nợ cho TẤT CẢ phiếu thu

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Copy toàn bộ nội dung file `recalculate_debt_for_all_invoices.sql`
3. Paste vào SQL Editor
4. Nhấn **Run** hoặc **Ctrl+Enter**

**Script này sẽ:**
- ✅ Kiểm tra bảng `phieu_thu_hoc_phi` có tồn tại không
- ✅ Tính lại nợ học phí cho TẤT CẢ các phiếu thu
- ✅ Chỉ tính từ các phiếu thu **CHƯA THANH TOÁN** (`status = 'unpaid'`) của các tháng/năm trước
- ✅ Cập nhật cột `debt` vào database
- ✅ Hiển thị kết quả thống kê

**Lưu ý:**
- Script sẽ tính nợ dựa trên logic: **Nợ = Tổng các phiếu thu chưa thanh toán của các tháng/năm trước**
- Chỉ cập nhật các phiếu có `debt` khác với giá trị tính toán

### Script 2: Tính lại nợ cho một học sinh cụ thể

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Copy toàn bộ nội dung file `recalculate_debt_for_student.sql`
3. **Sửa dòng 19**: Thay `'student123'` bằng ID học sinh thực tế
   ```sql
   target_student_id TEXT := 'student123';  -- THAY ĐỔI ID HỌC SINH Ở ĐÂY
   ```
4. Paste vào SQL Editor
5. Nhấn **Run** hoặc **Ctrl+Enter**

**Script này sẽ:**
- ✅ Tính lại nợ học phí cho một học sinh cụ thể
- ✅ Chỉ tính từ các phiếu thu **CHƯA THANH TOÁN** của các tháng/năm trước
- ✅ Cập nhật cột `debt` vào database
- ✅ Hiển thị kết quả

**Để tính lại nợ cho TẤT CẢ học sinh:**
- Uncomment phần "PHIÊN BẢN 2" trong script (dòng 60-95)

## 📊 Logic tính nợ

Nợ học phí được tính theo công thức:

```
Nợ của phiếu thu tháng M/N = Tổng các phiếu thu CHƯA THANH TOÁN của:
  - Tất cả các năm trước năm N
  - Các tháng trước tháng M trong cùng năm N
```

**Ví dụ:**
- Phiếu thu tháng 3/2024:
  - Nợ = Tổng các phiếu thu chưa thanh toán của: 1/2024, 2/2024, và tất cả các tháng của năm 2023, 2022, ...
- Phiếu thu tháng 1/2024:
  - Nợ = Tổng các phiếu thu chưa thanh toán của: tất cả các tháng của năm 2023, 2022, ...

## ⚠️ Lưu ý quan trọng

1. **Backup database trước khi chạy script** (nếu có thể)
2. **Kiểm tra kết quả** ở BƯỚC 3 (xem trước) trước khi cập nhật
3. Script chỉ tính nợ từ các **phiếu thu chưa thanh toán** (`status = 'unpaid'`)
4. Script **KHÔNG tính** nợ từ các buổi học chưa có phiếu thu (nếu có logic này trong code JavaScript)
5. Sau khi chạy script, **refresh lại trang web** để xem kết quả mới

## 🔍 Kiểm tra kết quả

Sau khi chạy script, kiểm tra:

1. **Tổng số phiếu có nợ:**
   ```sql
   SELECT COUNT(*) FROM phieu_thu_hoc_phi WHERE debt > 0;
   ```

2. **Tổng nợ theo học sinh:**
   ```sql
   SELECT student_id, SUM(debt) as total_debt
   FROM phieu_thu_hoc_phi
   GROUP BY student_id
   ORDER BY total_debt DESC;
   ```

3. **Chi tiết nợ của một học sinh:**
   ```sql
   SELECT month, year, status, final_amount, debt
   FROM phieu_thu_hoc_phi
   WHERE student_id = 'student_id_here'
   ORDER BY year, month;
   ```

## 🐛 Xử lý lỗi

Nếu gặp lỗi:
- **"relation phieu_thu_hoc_phi does not exist"**: Bảng chưa được tạo, cần tạo bảng trước
- **"column debt does not exist"**: Cột `debt` chưa có trong bảng, cần thêm cột
- **Syntax error**: Kiểm tra lại cú pháp SQL, đảm bảo đã copy đầy đủ script

## 📝 Ghi chú

- Script sử dụng `TEMP TABLE` nên không ảnh hưởng đến cấu trúc database
- Script chỉ cập nhật các phiếu có `debt` khác với giá trị tính toán (tối ưu hiệu suất)
- Cột `updated_at` sẽ được cập nhật tự động khi chạy script
