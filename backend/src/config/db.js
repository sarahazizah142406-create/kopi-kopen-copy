import mysql from "mysql2/promise";
import "dotenv/config";

export const pool = mysql.createPool({
  // Jika DB_HOST di .env kosong, dia akan lari ke localhost
  host: process.env.DB_HOST || "localhost",
  // Gunakan fallback 3306 (port MySQL standar) jika DB_PORT tidak diisi
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "kopi_kopen",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  // 🛑 WAJIB MASUKKAN SETELAN SSL INI UNTUK AIVEN:
  ssl: {
    rejectUnauthorized: false
  }
});

export async function assertDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}
