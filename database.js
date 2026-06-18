const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

// Almacenamos la base de datos en el directorio raíz o en un subdirectorio
const dbPath = path.resolve(__dirname, 'database.db');

let db = null;

async function getDatabaseConnection() {
  if (db) return db;

  // Abrir la base de datos SQLite
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Inicializar tablas necesarias
  await db.exec(`
    CREATE TABLE IF NOT EXISTS guestbook (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      company TEXT,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migraciones automáticas por si la base de datos ya existía en producción
  try {
    await db.exec('ALTER TABLE guestbook ADD COLUMN email TEXT');
  } catch (err) {
    // La columna ya existía, ignoramos el error
  }
  try {
    await db.exec('ALTER TABLE guestbook ADD COLUMN company TEXT');
  } catch (err) {
    // La columna ya existía, ignoramos el error
  }

  console.log('Base de datos SQLite inicializada correctamente en:', dbPath);
  return db;
}

// Obtener todos los mensajes ordenados por fecha descendente
async function getMessages() {
  const connection = await getDatabaseConnection();
  return connection.all('SELECT * FROM guestbook ORDER BY created_at DESC LIMIT 50');
}

// Guardar un nuevo mensaje / lead
async function saveMessage(name, message, email = null, company = null) {
  if (!name || !message) {
    throw new Error('El nombre y el mensaje son campos obligatorios.');
  }
  const connection = await getDatabaseConnection();
  return connection.run(
    'INSERT INTO guestbook (name, email, company, message) VALUES (?, ?, ?, ?)',
    [
      name.trim(),
      email ? email.trim() : null,
      company ? company.trim() : null,
      message.trim()
    ]
  );
}

module.exports = {
  getDatabaseConnection,
  getMessages,
  saveMessage
};
