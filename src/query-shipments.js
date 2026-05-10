require('dotenv').config({ path: './.env' });
const { pool } = require('./configs/sql.config');

async function test() {
  try {
    const [rows] = await pool.query('SELECT ShipmentID, Status FROM shipments WHERE Status = "ALARM"');
    console.log('ALARM shipments:', rows.length);
    console.log(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
