const express = require('express');
const path = require('path');
const os = require('os');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON y urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoint: Obtener todos los mensajes
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await db.getMessages();
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ success: false, error: 'Error al consultar la base de datos.' });
  }
});

// API Endpoint: Crear un nuevo mensaje
app.post('/api/messages', async (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) {
    return res.status(400).json({ success: false, error: 'Nombre y mensaje requeridos.' });
  }

  try {
    await db.saveMessage(name, message);
    res.json({ success: true, message: 'Mensaje guardado correctamente.' });
  } catch (error) {
    console.error('Error al guardar mensaje:', error);
    res.status(500).json({ success: false, error: 'Error al insertar en la base de datos.' });
  }
});

// API Endpoint: Estado del servidor (telemetría útil para la interfaz de administración)
app.get('/api/status', async (req, res) => {
  try {
    const memoryFree = os.freemem();
    const memoryTotal = os.totalmem();
    const memoryUsed = memoryTotal - memoryFree;

    res.json({
      success: true,
      data: {
        platform: os.platform(),
        release: os.release(),
        uptime: os.uptime(),
        cpuModel: os.cpus()[0]?.model || 'Desconocido',
        memory: {
          total: (memoryTotal / (1024 * 1024)).toFixed(2) + ' MB',
          used: (memoryUsed / (1024 * 1024)).toFixed(2) + ' MB',
          free: (memoryFree / (1024 * 1024)).toFixed(2) + ' MB',
          percentage: ((memoryUsed / memoryTotal) * 100).toFixed(1) + '%'
        },
        database: {
          type: 'SQLite3',
          path: path.resolve(__dirname, 'database.db')
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener estado:', error);
    res.status(500).json({ success: false, error: 'Error al obtener telemetría.' });
  }
});

// Arrancar base de datos y luego el servidor
(async () => {
  try {
    await db.getDatabaseConnection();
    app.listen(PORT, () => {
      console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Error fatal al iniciar la aplicación:', err);
    process.exit(1);
  }
})();
