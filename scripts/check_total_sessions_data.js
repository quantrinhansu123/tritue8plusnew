import { supabaseAdmin } from '../supabase.ts';

async function checkTotalSessionsData() {
  console.log('🔍 Kiểm tra dữ liệu "Số buổi" (total_sessions) trong phieu_thu_hoc_phi_chi_tiet...\n');

  try {
    // Lấy tất cả dữ liệu từ bảng chi tiết
    const { data: invoiceData, error } = await supabaseAdmin
      .from('phieu_thu_hoc_phi_chi_tiet')
      .select('*')
      .order('student_name', { ascending: true })
      .order('year', { ascending: true })
      .order('month', { ascending: true })
      .order('class_name', { ascending: true });

    if (error) {
      console.error('❌ Lỗi khi lấy dữ liệu:', error);
      return;
    }

    if (!invoiceData || invoiceData.length === 0) {
      console.log('⚠️ Không tìm thấy dữ liệu trong phieu_thu_hoc_phi_chi_tiet');
      return;
    }

    console.log(`✅ Tìm thấy ${invoiceData.length} records trong phieu_thu_hoc_phi_chi_tiet\n`);

    // Thống kê
    let nullTotalSessions = 0;
    let zeroTotalSessions = 0;
    let hasTotalSessions = 0;
    let totalSessionsSum = 0;

    // Group theo student + month + year để xem tổng số buổi
    const groupedInvoices = {};
    
    invoiceData.forEach(invoice => {
      const studentId = invoice.student_id || "";
      const month = invoice.month || 0;
      const year = invoice.year || 0;
      const groupKey = `${studentId}-${month}-${year}`;
      
      const totalSessions = invoice.total_sessions || 0;
      
      // Thống kê
      if (totalSessions === null || totalSessions === undefined) {
        nullTotalSessions++;
      } else if (totalSessions === 0) {
        zeroTotalSessions++;
      } else {
        hasTotalSessions++;
        totalSessionsSum += totalSessions;
      }
      
      if (!groupedInvoices[groupKey]) {
        groupedInvoices[groupKey] = {
          groupKey,
          studentId,
          studentName: invoice.student_name || "",
          studentCode: invoice.student_code || "",
          month,
          year,
          subjects: [],
          totalSessionsSum: 0,
        };
      }
      
      groupedInvoices[groupKey].subjects.push({
        subject: invoice.subject || "",
        classId: invoice.class_id || "",
        className: invoice.class_name || "",
        classCode: invoice.class_code || "",
        totalSessions: totalSessions,
        pricePerSession: invoice.price_per_session || 0,
        totalAmount: invoice.total_amount || 0,
      });
      
      groupedInvoices[groupKey].totalSessionsSum += totalSessions;
    });

    console.log('📊 Thống kê total_sessions:');
    console.log(`   - NULL/undefined: ${nullTotalSessions}`);
    console.log(`   - Bằng 0: ${zeroTotalSessions}`);
    console.log(`   - Có giá trị (>0): ${hasTotalSessions}`);
    console.log(`   - Tổng số buổi: ${totalSessionsSum}\n`);

    // Hiển thị một số ví dụ
    console.log('📋 Ví dụ một số invoices (grouped by student + month + year):\n');
    
    const sampleKeys = Object.keys(groupedInvoices).slice(0, 10);
    sampleKeys.forEach(key => {
      const invoice = groupedInvoices[key];
      console.log(`📌 ${invoice.studentName} (${invoice.studentCode}) - Tháng ${invoice.month}/${invoice.year}:`);
      console.log(`   Tổng số buổi: ${invoice.totalSessionsSum}`);
      console.log(`   Số môn học: ${invoice.subjects.length}`);
      invoice.subjects.forEach((subject, idx) => {
        console.log(`   ${idx + 1}. ${subject.className} (${subject.classCode})`);
        console.log(`      - Subject: ${subject.subject || 'N/A'}`);
        console.log(`      - Số buổi: ${subject.totalSessions || 0}`);
        console.log(`      - Đơn giá: ${subject.pricePerSession?.toLocaleString('vi-VN') || 0} đ`);
        console.log(`      - Thành tiền: ${subject.totalAmount?.toLocaleString('vi-VN') || 0} đ`);
      });
      console.log('');
    });

    // Kiểm tra các records có vấn đề
    console.log('\n⚠️ Các records có vấn đề:\n');
    let issueCount = 0;
    
    invoiceData.forEach(invoice => {
      const issues = [];
      
      if (invoice.total_sessions === null || invoice.total_sessions === undefined) {
        issues.push('total_sessions là NULL');
      }
      if (invoice.total_sessions === 0 && invoice.total_amount > 0) {
        issues.push('total_sessions = 0 nhưng total_amount > 0');
      }
      if (invoice.total_sessions > 0 && invoice.total_amount === 0) {
        issues.push('total_sessions > 0 nhưng total_amount = 0');
      }
      if (invoice.total_sessions > 0 && invoice.price_per_session > 0) {
        const expectedAmount = invoice.total_sessions * invoice.price_per_session;
        if (Math.abs(invoice.total_amount - expectedAmount) > 1) {
          issues.push(`total_amount không khớp: ${invoice.total_amount} vs ${expectedAmount} (${invoice.total_sessions} × ${invoice.price_per_session})`);
        }
      }
      
      if (issues.length > 0) {
        issueCount++;
        console.log(`❌ ${invoice.student_name || 'N/A'} - Tháng ${invoice.month}/${invoice.year} - ${invoice.class_name || 'N/A'}:`);
        issues.forEach(issue => console.log(`   - ${issue}`));
        console.log(`   Record ID: ${invoice.id}`);
        console.log('');
      }
    });

    if (issueCount === 0) {
      console.log('✅ Không có records nào có vấn đề!');
    } else {
      console.log(`⚠️ Tìm thấy ${issueCount} records có vấn đề`);
    }

    console.log('\n✅ Hoàn thành kiểm tra!');
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
}

checkTotalSessionsData()
  .then(() => {
    console.log('\n✅ Script hoàn thành');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  });
