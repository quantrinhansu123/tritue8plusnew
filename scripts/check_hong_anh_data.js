/**
 * Script để kiểm tra dữ liệu của Hồng Anh tháng 2/2026
 */

import { supabaseAdmin } from '../supabase.ts';

async function checkHongAnhData() {
  console.log('🔍 Kiểm tra dữ liệu của Hồng Anh tháng 2/2026...\n');

  try {
    // Lấy dữ liệu từ bảng chi tiết
    const { data: invoiceData, error } = await supabaseAdmin
      .from('phieu_thu_hoc_phi_chi_tiet')
      .select('*')
      .or(`student_name.ilike.%Hồng Anh%,student_name.ilike.%Hong Anh%`)
      .eq('year', 2026)
      .eq('month', 2)
      .order('class_name', { ascending: true });

    if (error) {
      console.error('❌ Lỗi khi lấy dữ liệu:', error);
      return;
    }

    if (!invoiceData || invoiceData.length === 0) {
      console.log('⚠️ Không tìm thấy dữ liệu cho Hồng Anh tháng 2/2026');
      return;
    }

    console.log(`✅ Tìm thấy ${invoiceData.length} records cho Hồng Anh tháng 2/2026:\n`);

    // Group theo student_id + month + year
    const groupedInvoices = {};
    
      invoiceData.forEach((invoiceDetail) => {
      const studentId = invoiceDetail.student_id || "";
      const month = invoiceDetail.month || 0;
      const year = invoiceDetail.year || 0;
      const groupKey = `${studentId}-${month}-${year}`;
      
      if (!groupedInvoices[groupKey]) {
        groupedInvoices[groupKey] = {
          groupKey,
          studentId,
          studentName: invoiceDetail.student_name || "",
          studentCode: invoiceDetail.student_code || "",
          month,
          year,
          subjects: [],
        };
      }
      
      groupedInvoices[groupKey].subjects.push({
        subject: invoiceDetail.subject || "",
        classId: invoiceDetail.class_id || "",
        className: invoiceDetail.class_name || "",
        classCode: invoiceDetail.class_code || "",
        pricePerSession: invoiceDetail.price_per_session || 0,
        totalSessions: invoiceDetail.total_sessions || 0,
        totalAmount: invoiceDetail.total_amount || 0,
      });
    });

    // Hiển thị kết quả
    Object.values(groupedInvoices).forEach((invoice) => {
      console.log(`📋 Invoice Group Key: ${invoice.groupKey}`);
      console.log(`   Học sinh: ${invoice.studentName} (${invoice.studentCode})`);
      console.log(`   Tháng/Năm: ${invoice.month}/${invoice.year}`);
      console.log(`   Số môn học: ${invoice.subjects.length}`);
      console.log(`\n   Chi tiết các môn học:`);
      invoice.subjects.forEach((subject, index) => {
        console.log(`   ${index + 1}. ${subject.className} (${subject.classCode})`);
        console.log(`      - Subject: ${subject.subject || 'N/A'}`);
        console.log(`      - Đơn giá: ${subject.pricePerSession?.toLocaleString('vi-VN') || 0} đ`);
        console.log(`      - Số buổi: ${subject.totalSessions || 0}`);
        console.log(`      - Thành tiền: ${subject.totalAmount?.toLocaleString('vi-VN') || 0} đ`);
      });
      console.log('');
    });

    console.log('✅ Hoàn thành kiểm tra!');
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
}

checkHongAnhData()
  .then(() => {
    console.log('\n✅ Script hoàn thành');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  });
