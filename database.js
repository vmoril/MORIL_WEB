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
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Base de datos SQLite inicializada correctamente en:', dbPath);
  return db;
}

// Obtener todos los mensajes ordenados por fecha descendente
async function getMessages() {
  const connection = await getDatabaseConnection();
  return connection.all('SELECT * FROM guestbook ORDER BY created_at DESC LIMIT 50');
}

// Guardar un nuevo mensaje
async function saveMessage(name, message) {
  if (!name || !message) {
    throw new Error('El nombre y el mensaje son campos obligatorios.');
  }
  const connection = await getDatabaseConnection();
  return connection.run(
    'INSERT INTO guestbook (name, message) VALUES (?, ?)',
    [name.trim(), message.trim()]
  );
}

module.exports = {
  getDatabaseConnection,
  getMessages,
  saveMessage
};
