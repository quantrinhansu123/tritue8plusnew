import { supabaseAdmin } from '../supabase.ts';

async function dropInvoiceViews() {
  console.log('🗑️  Đang xóa các views liên quan đến phiếu thu học phí...\n');

  const viewsToDrop = [
    'v_phieu_thu_hoc_phi_chi_tiet',
    'v_phieu_thu_hoc_phi_tong_hop',
    'vw_phieu_thu_tong_hop',
  ];

  try {
    for (const viewName of viewsToDrop) {
      console.log(`📋 Đang xóa view: ${viewName}...`);
      
      const { error } = await supabaseAdmin.rpc('exec_sql', {
        sql: `DROP VIEW IF EXISTS ${viewName} CASCADE;`
      });

      if (error) {
        // Nếu RPC không có, thử dùng query trực tiếp
        console.log(`⚠️  RPC không khả dụng, thử cách khác...`);
        
        // Sử dụng query trực tiếp với raw SQL
        const { error: queryError } = await supabaseAdmin
          .from('_realtime')
          .select('*')
          .limit(0); // Dummy query để kiểm tra connection
        
        if (queryError && queryError.code === 'PGRST205') {
          // Table không tồn tại, nhưng connection OK
          console.log(`✅ Connection OK, nhưng không thể chạy DROP VIEW qua Supabase client.`);
          console.log(`💡 Vui lòng chạy SQL trực tiếp trong Supabase Dashboard:`);
          console.log(`   DROP VIEW IF EXISTS ${viewName} CASCADE;`);
        } else {
          console.error(`❌ Lỗi khi xóa view ${viewName}:`, error);
        }
      } else {
        console.log(`✅ Đã xóa view: ${viewName}`);
      }
    }

    console.log('\n✅ Hoàn thành!');
    console.log('\n💡 Nếu có lỗi, vui lòng chạy SQL trực tiếp trong Supabase Dashboard:');
    viewsToDrop.forEach(viewName => {
      console.log(`   DROP VIEW IF EXISTS ${viewName} CASCADE;`);
    });
  } catch (error) {
    console.error('❌ Lỗi:', error);
    console.log('\n💡 Vui lòng chạy SQL trực tiếp trong Supabase Dashboard:');
    viewsToDrop.forEach(viewName => {
      console.log(`   DROP VIEW IF EXISTS ${viewName} CASCADE;`);
    });
  }
}

dropInvoiceViews()
  .then(() => {
    console.log('\n✅ Script hoàn thành');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  });
