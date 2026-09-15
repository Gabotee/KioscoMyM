/**
 * database.js — MySQL via mysql2/promise (connection pool)
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool = null;

function getDb() {
  if (!pool) throw new Error('Base de datos no inicializada. Llamá primero a initDatabase().');
  return pool;
}

async function initDatabase() {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'local',
  });

  // Verificar conexión
  const conn = await pool.getConnection();

  // Migración: agregar columna surcharge a movements si no existe
  await conn.query(`
    ALTER TABLE movements
    ADD COLUMN IF NOT EXISTS surcharge DECIMAL(10,2) NOT NULL DEFAULT 0
  `);

  conn.release();
  console.log('✅ Conexión a MySQL establecida');

  console.log('✅ Base de datos lista');
}

module.exports = { getDb, initDatabase };
