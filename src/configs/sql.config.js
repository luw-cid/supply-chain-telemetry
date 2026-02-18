// connect sql
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.MySQL_HOST || 'localhost',
    user: process.env.MySQL_USER || 'root',
    password: process.env.MySQL_PASSWORD || '',
    database: process.env.MySQL_DATABASE || 'supply_chain_sql',
    port: process.env.MySQL_PORT || 3306,
});

async function connectMySQL() {
    try {
        const connection = await pool.getConnection();
        console.log('[MySQL]Connected to', process.env.MySQL_DATABASE);
        connection.release();
    } catch (error) {
        console.error('[MySQL]Error connecting to', process.env.MySQL_DATABASE, error);
        throw error;
    }
}

module.exports = { pool, connectMySQL };