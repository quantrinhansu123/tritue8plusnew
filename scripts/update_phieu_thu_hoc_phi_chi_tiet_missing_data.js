/**
 * Script để cập nhật các trường thiếu trong bảng phieu_thu_hoc_phi_chi_tiet
 * - price_per_session: lấy từ lop_hoc_hoc_sinh.hoc_phi_rieng hoặc lop_hoc.hoc_phi_moi_buoi
 * - subject: lấy từ lop_hoc.mon_hoc
 * - total_amount: tính lại từ price_per_session * total_sessions
 */

import { supabaseAdmin } from '../supabase.ts';

async function updateMissingData() {
  console.log('🔄 Bắt đầu cập nhật dữ liệu thiếu trong bảng phieu_thu_hoc_phi_chi_tiet...\n');

  try {
    // 1. Lấy tất cả records từ phieu_thu_hoc_phi_chi_tiet
    const { data: invoiceData, error: invoiceError } = await supabaseAdmin
      .from('phieu_thu_hoc_phi_chi_tiet')
      .select('*');

    if (invoiceError) {
      console.error('❌ Lỗi khi lấy dữ liệu từ phieu_thu_hoc_phi_chi_tiet:', invoiceError);
      return;
    }

    if (!invoiceData || invoiceData.length === 0) {
      console.log('⚠️ Không có dữ liệu trong bảng phieu_thu_hoc_phi_chi_tiet');
      return;
    }

    console.log(`✅ Đã lấy được ${invoiceData.length} records\n`);

    // 2. Lấy dữ liệu từ lop_hoc và lop_hoc_hoc_sinh
    const { data: classesData, error: classesError } = await supabaseAdmin
      .from('lop_hoc')
      .select('*');

    if (classesError) {
      console.error('❌ Lỗi khi lấy dữ liệu từ lop_hoc:', classesError);
      return;
    }

    const { data: enrollmentsData, error: enrollmentsError } = await supabaseAdmin
      .from('lop_hoc_hoc_sinh')
      .select('*');

    if (enrollmentsError) {
      console.error('❌ Lỗi khi lấy dữ liệu từ lop_hoc_hoc_sinh:', enrollmentsError);
      return;
    }

    console.log(`✅ Đã lấy được ${classesData?.length || 0} lớp học và ${enrollmentsData?.length || 0} enrollments\n`);

    // 3. Tạo map để tra cứu nhanh
    const classesMap = new Map();
    if (classesData) {
      classesData.forEach((cls) => {
        classesMap.set(cls.id, cls);
      });
    }

    const enrollmentsMap = new Map();
    if (enrollmentsData) {
      enrollmentsData.forEach((enrollment) => {
        const key = `${enrollment.student_id}-${enrollment.class_id}`;
        enrollmentsMap.set(key, enrollment);
      });
    }

    // 4. Cập nhật từng record
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const invoice of invoiceData) {
      const updates = {};
      let needsUpdate = false;

      // 4.1. Cập nhật subject từ lop_hoc.mon_hoc
      if (!invoice.subject || invoice.subject.trim() === '') {
        const classInfo = classesMap.get(invoice.class_id);
        if (classInfo && classInfo.mon_hoc) {
          updates.subject = classInfo.mon_hoc;
          needsUpdate = true;
        }
      }

      // 4.2. Cập nhật price_per_session
      if (!invoice.price_per_session || invoice.price_per_session === 0) {
        let pricePerSession = null;

        // Ưu tiên 1: hoc_phi_rieng từ lop_hoc_hoc_sinh
        if (invoice.student_id && invoice.class_id) {
          const enrollmentKey = `${invoice.student_id}-${invoice.class_id}`;
          const enrollment = enrollmentsMap.get(enrollmentKey);
          if (enrollment && enrollment.hoc_phi_rieng !== null && enrollment.hoc_phi_rieng !== undefined) {
            pricePerSession = enrollment.hoc_phi_rieng;
          }
        }

        // Ưu tiên 2: hoc_phi_moi_buoi từ lop_hoc
        if (!pricePerSession || pricePerSession === 0) {
          const classInfo = classesMap.get(invoice.class_id);
          if (classInfo && classInfo.hoc_phi_moi_buoi) {
            pricePerSession = classInfo.hoc_phi_moi_buoi;
          }
        }

        if (pricePerSession && pricePerSession > 0) {
          updates.price_per_session = pricePerSession;
          needsUpdate = true;
        }
      }

      // 4.3. Tính lại total_amount nếu có price_per_session và total_sessions
      if (invoice.price_per_session || updates.price_per_session) {
        const pricePerSession = updates.price_per_session || invoice.price_per_session;
        const totalSessions = invoice.total_sessions || 0;
        
        if (pricePerSession > 0 && totalSessions > 0) {
          const calculatedTotalAmount = pricePerSession * totalSessions;
          
          // Chỉ cập nhật nếu total_amount = 0 hoặc khác với giá trị tính toán
          if (!invoice.total_amount || invoice.total_amount === 0 || invoice.total_amount !== calculatedTotalAmount) {
            updates.total_amount = calculatedTotalAmount;
            
            // Tính lại final_amount nếu có discount
            const discount = invoice.discount || 0;
            updates.final_amount = Math.max(0, calculatedTotalAmount - discount);
            needsUpdate = true;
          }
        }
      }

      // 5. Cập nhật vào database nếu có thay đổi
      if (needsUpdate && Object.keys(updates).length > 0) {
        try {
          const { error: updateError } = await supabaseAdmin
            .from('phieu_thu_hoc_phi_chi_tiet')
            .update(updates)
            .eq('id', invoice.id);

          if (updateError) {
            console.error(`❌ Lỗi khi cập nhật record ${invoice.id}:`, updateError);
            errors.push({ id: invoice.id, error: updateError.message });
          } else {
            updatedCount++;
            if (updatedCount % 10 === 0) {
              console.log(`✅ Đã cập nhật ${updatedCount} records...`);
            }
          }
        } catch (error) {
          console.error(`❌ Lỗi khi cập nhật record ${invoice.id}:`, error);
          errors.push({ id: invoice.id, error: error.message });
        }
      } else {
        skippedCount++;
      }
    }

    // 6. Tóm tắt kết quả
    console.log(`\n\n📊 KẾT QUẢ CẬP NHẬT:\n`);
    console.log(`✅ Đã cập nhật: ${updatedCount} records`);
    console.log(`⏭️  Đã bỏ qua: ${skippedCount} records (không cần cập nhật)`);
    console.log(`❌ Lỗi: ${errors.length} records`);

    if (errors.length > 0) {
      console.log(`\n❌ Chi tiết lỗi (${Math.min(errors.length, 10)} đầu tiên):`);
      errors.slice(0, 10).forEach((err, index) => {
        console.log(`   ${index + 1}. ID: ${err.id} - ${err.error}`);
      });
    }

    console.log('\n✅ Hoàn thành cập nhật!');
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật dữ liệu:', error);
  }
}

// Chạy script
updateMissingData()
  .then(() => {
    console.log('\n✅ Script hoàn thành');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  });
