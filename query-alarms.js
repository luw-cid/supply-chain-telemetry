require('dotenv').config({ path: './src/.env' });
const { pool } = require('./src/configs/sql.config');

async function test() {
  try {
    const [rows] = await pool.query('SELECT * FROM alarmevents WHERE Status = "OPEN"');
    console.log('OPEN alarms:', rows.length);
    console.log(rows);
    
    const [all] = await pool.query('SELECT * FROM alarmevents');
    console.log('ALL alarms:', all.length);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
