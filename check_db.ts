import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function check() {
  console.log('Host:', process.env.DB_HOST);
  console.log('User:', process.env.DB_USER);
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });
  
  try {
    const [rows] = await pool.query('DESCRIBE users');
    console.log(rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

check();
