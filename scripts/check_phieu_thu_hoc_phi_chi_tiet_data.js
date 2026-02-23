/**
 * Script để kiểm tra dữ liệu trong bảng phieu_thu_hoc_phi_chi_tiet
 * Kiểm tra các trường quan trọng: class_name, class_code, price_per_session
 */

import { supabaseAdmin } from '../supabase.ts';

async function checkPhieuThuHocPhiChiTietData() {
  console.log('🔍 Bắt đầu kiểm tra dữ liệu trong bảng phieu_thu_hoc_phi_chi_tiet...\n');

  try {
    // 1. Kiểm tra tổng số records
    const { data: totalData, error: totalError } = await supabaseAdmin
      .from('phieu_thu_hoc_phi_chi_tiet')
      .select('id', { count: 'exact', head: true });

    if (totalError) {
      console.error('❌ Lỗi khi đếm tổng số records:', totalError);
      return;
    }

    console.log(`📊 Tổng số records: ${totalData?.length || 0}\n`);

    // 2. Lấy tất cả dữ liệu để phân tích
    const { data: allData, error: allError } = await supabaseAdmin
      .from('phieu_thu_hoc_phi_chi_tiet')
      .select('*')
      .order('student_name', { ascending: true })
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (allError) {
      console.error('❌ Lỗi khi lấy dữ liệu:', allError);
      return;
    }

    if (!allData || allData.length === 0) {
      console.log('⚠️ Không có dữ liệu trong bảng phieu_thu_hoc_phi_chi_tiet');
      return;
    }

    console.log(`✅ Đã lấy được ${allData.length} records\n`);

    // 3. Phân tích các trường
    const analysis = {
      total: allData.length,
      hasClassName: 0,
      missingClassName: 0,
      hasClassCode: 0,
      missingClassCode: 0,
      hasPricePerSession: 0,
      missingPricePerSession: 0,
      hasSubject: 0,
      missingSubject: 0,
      hasAllFields: 0,
      missingAnyField: 0,
    };

    const missingRecords = [];
    const completeRecords = [];

    allData.forEach((record) => {
      // Kiểm tra class_name
      if (record.class_name && record.class_name.trim() !== '') {
        analysis.hasClassName++;
      } else {
        analysis.missingClassName++;
      }

      // Kiểm tra class_code
      if (record.class_code && record.class_code.trim() !== '') {
        analysis.hasClassCode++;
      } else {
        analysis.missingClassCode++;
      }

      // Kiểm tra price_per_session
      if (record.price_per_session !== null && record.price_per_session !== undefined && record.price_per_session > 0) {
        analysis.hasPricePerSession++;
      } else {
        analysis.missingPricePerSession++;
      }

      // Kiểm tra subject
      if (record.subject && record.subject.trim() !== '') {
        analysis.hasSubject++;
      } else {
        analysis.missingSubject++;
      }

      // Kiểm tra tất cả các trường
      const hasAll =
        record.class_name && record.class_name.trim() !== '' &&
        record.class_code && record.class_code.trim() !== '' &&
        record.price_per_session !== null && record.price_per_session !== undefined && record.price_per_session > 0;

      if (hasAll) {
        analysis.hasAllFields++;
        if (completeRecords.length < 5) {
          completeRecords.push(record);
        }
      } else {
        analysis.missingAnyField++;
        if (missingRecords.length < 20) {
          missingRecords.push(record);
        }
      }
    });

    // 4. In kết quả phân tích
    console.log('📋 KẾT QUẢ PHÂN TÍCH:\n');
    console.log(`Tổng số records: ${analysis.total}`);
    console.log(`\n✅ Có dữ liệu:`);
    console.log(`   - class_name: ${analysis.hasClassName} (${((analysis.hasClassName / analysis.total) * 100).toFixed(1)}%)`);
    console.log(`   - class_code: ${analysis.hasClassCode} (${((analysis.hasClassCode / analysis.total) * 100).toFixed(1)}%)`);
    console.log(`   - price_per_session: ${analysis.hasPricePerSession} (${((analysis.hasPricePerSession / analysis.total) * 100).toFixed(1)}%)`);
    console.log(`   - subject: ${analysis.hasSubject} (${((analysis.hasSubject / analysis.total) * 100).toFixed(1)}%)`);
    console.log(`\n❌ Thiếu dữ liệu:`);
    console.log(`   - class_name: ${analysis.missingClassName} (${((analysis.missingClassName / analysis.total) * 100).toFixed(1)}%)`);
    console.log(`   - class_code: ${analysis.missingClassCode} (${((analysis.missingClassCode / analysis.total) * 100).toFixed(1)}%)`);
    console.log(`   - price_per_session: ${analysis.missingPricePerSession} (${((analysis.missingPricePerSession / analysis.total) * 100).toFixed(1)}%)`);
    console.log(`   - subject: ${analysis.missingSubject} (${((analysis.missingSubject / analysis.total) * 100).toFixed(1)}%)`);
    console.log(`\n📊 Tổng kết:`);
    console.log(`   - Đầy đủ tất cả trường: ${analysis.hasAllFields} (${((analysis.hasAllFields / analysis.total) * 100).toFixed(1)}%)`);
    console.log(`   - Thiếu ít nhất 1 trường: ${analysis.missingAnyField} (${((analysis.missingAnyField / analysis.total) * 100).toFixed(1)}%)`);

    // 5. Hiển thị các records thiếu dữ liệu
    if (missingRecords.length > 0) {
      console.log(`\n\n❌ CÁC RECORDS THIẾU DỮ LIỆU (hiển thị ${missingRecords.length} records đầu tiên):\n`);
      missingRecords.forEach((record, index) => {
        const issues = [];
        if (!record.class_name || record.class_name.trim() === '') issues.push('class_name');
        if (!record.class_code || record.class_code.trim() === '') issues.push('class_code');
        if (!record.price_per_session || record.price_per_session === 0) issues.push('price_per_session');
        if (!record.subject || record.subject.trim() === '') issues.push('subject');

        console.log(`${index + 1}. ID: ${record.id}`);
        console.log(`   Học sinh: ${record.student_name || 'N/A'} (${record.student_code || 'N/A'})`);
        console.log(`   Class ID: ${record.class_id || 'N/A'}`);
        console.log(`   class_name: ${record.class_name || '❌ NULL/EMPTY'}`);
        console.log(`   class_code: ${record.class_code || '❌ NULL/EMPTY'}`);
        console.log(`   price_per_session: ${record.price_per_session || '❌ NULL/0'}`);
        console.log(`   subject: ${record.subject || '❌ NULL/EMPTY'}`);
        console.log(`   Tháng/Năm: ${record.month || 'N/A'}/${record.year || 'N/A'}`);
        console.log(`   ⚠️ Thiếu: ${issues.join(', ')}\n`);
      });
    }

    // 6. Hiển thị các records đầy đủ (mẫu)
    if (completeRecords.length > 0) {
      console.log(`\n\n✅ CÁC RECORDS ĐẦY ĐỦ (mẫu ${completeRecords.length} records):\n`);
      completeRecords.forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record.id}`);
        console.log(`   Học sinh: ${record.student_name || 'N/A'} (${record.student_code || 'N/A'})`);
        console.log(`   class_name: ${record.class_name}`);
        console.log(`   class_code: ${record.class_code}`);
        console.log(`   price_per_session: ${record.price_per_session?.toLocaleString('vi-VN')} đ`);
        console.log(`   subject: ${record.subject || 'N/A'}`);
        console.log(`   Tháng/Năm: ${record.month || 'N/A'}/${record.year || 'N/A'}\n`);
      });
    }

    // 7. Kiểm tra dữ liệu cho học sinh "Yến Vy" (HS003) - tháng 2/2026
    const yenVyData = allData.filter(
      (record) =>
        (record.student_name && record.student_name.includes('Yến Vy')) ||
        record.student_code === 'HS003'
    ).filter((record) => record.year === 2026 && record.month === 2);

    if (yenVyData.length > 0) {
      console.log(`\n\n🔍 DỮ LIỆU CHO HỌC SINH "YẾN VY" (HS003) - THÁNG 2/2026:\n`);
      yenVyData.forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record.id}`);
        console.log(`   class_name: ${record.class_name || '❌ NULL/EMPTY'}`);
        console.log(`   class_code: ${record.class_code || '❌ NULL/EMPTY'}`);
        console.log(`   price_per_session: ${record.price_per_session || '❌ NULL/0'}`);
        console.log(`   total_sessions: ${record.total_sessions || 0}`);
        console.log(`   total_amount: ${record.total_amount || 0}`);
        console.log(`   final_amount: ${record.final_amount || 0}\n`);
      });
    } else {
      console.log(`\n\n⚠️ Không tìm thấy dữ liệu cho học sinh "Yến Vy" (HS003) - tháng 2/2026`);
    }

    console.log('\n✅ Hoàn thành kiểm tra!');
  } catch (error) {
    console.error('❌ Lỗi khi kiểm tra dữ liệu:', error);
  }
}

// Chạy script
checkPhieuThuHocPhiChiTietData()
  .then(() => {
    console.log('\n✅ Script hoàn thành');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  });
