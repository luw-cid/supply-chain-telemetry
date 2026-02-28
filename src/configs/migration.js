const fs = require('fs').promises;
const path = require('path');
const { pool } = require('./sql.config');

/**
 * Chạy migration từ file SQL
 * Tự động tạo/cập nhật schema khi khởi động ứng dụng
 */
async function runMigration() {
    try {
        console.log('[Migration] Bắt đầu migration...');
        
        // Đọc file SQL
        const sqlFilePath = path.join(__dirname, 'mysql.sql');
        const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
        
        // Tách các câu lệnh SQL (split by semicolon, bỏ qua comments)
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        const connection = await pool.getConnection();
        
        try {
            console.log(`[Migration] Thực thi ${statements.length} câu lệnh SQL...`);
            
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                
                // Bỏ qua các comment blocks và empty statements
                if (statement.startsWith('/*') || statement.length < 10) {
                    continue;
                }
                
                try {
                    await connection.query(statement);
                } catch (error) {
                    // Log warning nhưng không dừng migration
                    console.warn(`[Migration] Warning tại statement ${i + 1}:`, error.message);
                }
            }
            
            console.log('[Migration] ✓ Migration hoàn tất thành công');
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('[Migration] ✗ Lỗi khi chạy migration:', error);
        throw error;
    }
}

module.exports = { runMigration };
