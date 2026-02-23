/**
 * Script để kiểm tra và xử lý các records trùng lặp trong bảng phieu_thu_hoc_phi_chi_tiet
 */

import { supabaseAdmin } from '../supabase.ts';

async function checkAndFixDuplicates() {
  console.log('🔍 Kiểm tra và xử lý records trùng lặp...\n');

  try {
    // 1. Tìm các records trùng lặp
    const { data: allData, error: allError } = await supabaseAdmin
      .from('phieu_thu_hoc_phi_chi_tiet')
      .select('*')
      .order('student_name', { ascending: true })
      .order('year', { ascending: true })
      .order('month', { ascending: true })
      .order('class_name', { ascending: true });

    if (allError) {
      console.error('❌ Lỗi khi lấy dữ liệu:', allError);
      return;
    }

    if (!allData || allData.length === 0) {
      console.log('⚠️ Không có dữ liệu');
      return;
    }

    console.log(`✅ Đã lấy được ${allData.length} records\n`);

    // 2. Tìm các records trùng lặp dựa trên (student_id, class_id, month, year)
    const duplicateMap = new Map();
    
    allData.forEach((record) => {
      const key = `${record.student_id}-${record.class_id}-${record.month}-${record.year}`;
      if (!duplicateMap.has(key)) {
        duplicateMap.set(key, []);
      }
      duplicateMap.get(key).push(record);
    });

    // 3. Tìm các key có nhiều hơn 1 record
    const duplicates = [];
    duplicateMap.forEach((records, key) => {
      if (records.length > 1) {
        duplicates.push({ key, records });
      }
    });

    if (duplicates.length === 0) {
      console.log('✅ Không có records trùng lặp\n');
    } else {
      console.log(`⚠️ Tìm thấy ${duplicates.length} nhóm records trùng lặp:\n`);
      
      duplicates.forEach((dup, index) => {
        console.log(`${index + 1}. Key: ${dup.key}`);
        console.log(`   Số records: ${dup.records.length}`);
        dup.records.forEach((record, idx) => {
          console.log(`   ${idx + 1}. ID: ${record.id}`);
          console.log(`      Học sinh: ${record.student_name} (${record.student_code})`);
          console.log(`      Lớp: ${record.class_name} (${record.class_code})`);
          console.log(`      Tháng/Năm: ${record.month}/${record.year}`);
          console.log(`      Created: ${record.created_at}`);
        });
        console.log('');
      });
    }

    // 4. Kiểm tra cụ thể cho Hồng Anh tháng 2/2026
    console.log('\n🔍 Kiểm tra cụ thể cho Hồng Anh tháng 2/2026:\n');
    const hongAnhRecords = allData.filter(
      (record) =>
        (record.student_name && record.student_name.includes('Hồng Anh')) &&
        record.year === 2026 &&
        record.month === 2
    );

    if (hongAnhRecords.length === 0) {
      console.log('⚠️ Không tìm thấy records cho Hồng Anh tháng 2/2026');
    } else {
      console.log(`✅ Tìm thấy ${hongAnhRecords.length} records cho Hồng Anh tháng 2/2026:\n`);
      
      // Group theo class_id để xem có bao nhiêu môn học
      const classMap = new Map();
      hongAnhRecords.forEach((record) => {
        if (!classMap.has(record.class_id)) {
          classMap.set(record.class_id, []);
        }
        classMap.get(record.class_id).push(record);
      });

      console.log(`📚 Số môn học (lớp học) khác nhau: ${classMap.size}\n`);
      
      classMap.forEach((records, classId) => {
        const firstRecord = records[0];
        console.log(`   - ${firstRecord.class_name} (${firstRecord.class_code})`);
        console.log(`     Subject: ${firstRecord.subject || 'N/A'}`);
        console.log(`     Đơn giá: ${firstRecord.price_per_session?.toLocaleString('vi-VN') || 0} đ`);
        console.log(`     Số buổi: ${firstRecord.total_sessions || 0}`);
        console.log(`     Thành tiền: ${firstRecord.total_amount?.toLocaleString('vi-VN') || 0} đ`);
        if (records.length > 1) {
          console.log(`     ⚠️ Có ${records.length} records trùng lặp cho lớp này!`);
        }
        console.log('');
      });
    }

    // 5. Nếu có duplicates, đề xuất cách xử lý
    if (duplicates.length > 0) {
      console.log('\n💡 ĐỀ XUẤT XỬ LÝ:\n');
      console.log('1. Giữ lại record mới nhất (created_at mới nhất)');
      console.log('2. Xóa các records cũ hơn');
      console.log('3. Hoặc merge dữ liệu từ các records trùng lặp\n');
      
      console.log('Bạn có muốn tự động xóa các records trùng lặp (giữ lại record mới nhất)?');
      console.log('Chạy script: scripts/fix_duplicate_invoices.js để tự động xử lý\n');
    }

    console.log('✅ Hoàn thành kiểm tra!');
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
}

checkAndFixDuplicates()
  .then(() => {
    console.log('\n✅ Script hoàn thành');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  });
