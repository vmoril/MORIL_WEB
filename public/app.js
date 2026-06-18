document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM - Telemetría
  const ramPercentage = document.getElementById('ram-percentage');
  const ramProgress = document.getElementById('ram-progress');
  const ramUsed = document.getElementById('ram-used');
  const ramTotal = document.getElementById('ram-total');
  const cpuModel = document.getElementById('cpu-model');
  const uptimeEl = document.getElementById('uptime');
  const osPlatform = document.getElementById('os-platform');
  const dbType = document.getElementById('db-type');
  const dbPath = document.getElementById('db-path');
  const refreshTelemetryBtn = document.getElementById('refresh-telemetry-btn');
  const connectionStatus = document.getElementById('connection-status');

  // Elementos del DOM - Libro de Visitas
  const messageForm = document.getElementById('message-form');
  const inputName = document.getElementById('input-name');
  const inputMessage = document.getElementById('input-message');
  const messagesContainer = document.getElementById('messages-container');
  const messagesCount = document.getElementById('messages-count');
  const submitBtn = document.getElementById('submit-btn');

  // --- FUNCIONES DE TELEMETRÍA ---

  // Formatear segundos a formato de días, horas, minutos y segundos
  function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);

    const dDisplay = d > 0 ? `${d}d ` : "";
    const hDisplay = h > 0 ? `${h}h ` : "";
    const mDisplay = m > 0 ? `${m}m ` : "";
    const sDisplay = `${s}s`;
    return dDisplay + hDisplay + mDisplay + sDisplay;
  }

  // Cargar telemetría del servidor
  async function fetchTelemetry() {
    // Rotar botón de actualizar
    const refreshIcon = refreshTelemetryBtn.querySelector('i');
    refreshIcon.classList.add('fa-spin');

    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error('Error en la respuesta del servidor');
      
      const result = await response.json();
      
      if (result.success) {
        const { platform, release, uptime, cpuModel: cpu, memory, database } = result.data;

        // Actualizar interfaz
        osPlatform.textContent = `${platform} (${release})`;
        cpuModel.textContent = cpu;
        cpuModel.title = cpu; // Tooltip para nombres largos
        uptimeEl.textContent = formatUptime(uptime);
        dbType.textContent = database.type;
        dbPath.textContent = database.path.split(/[\\/]/).pop(); // Solo nombre de archivo para limpieza
        dbPath.title = database.path; // Ruta completa en tooltip

        // RAM stats
        ramPercentage.textContent = memory.percentage;
        ramProgress.style.width = memory.percentage;
        ramUsed.textContent = memory.used;
        ramTotal.textContent = memory.total;

        // Resetear barra de progreso por colores de alerta si supera 85%
        const numericPercentage = parseFloat(memory.percentage);
        if (numericPercentage > 85) {
          ramProgress.style.background = 'var(--color-error)';
        } else {
          ramProgress.style.background = 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))';
        }

        connectionStatus.textContent = "Conectado al servidor";
        connectionStatus.parentElement.querySelector('.pulse-dot').style.backgroundColor = 'var(--color-success)';
      }
    } catch (error) {
      console.error('Error al cargar telemetría:', error);
      connectionStatus.textContent = "Error de conexión";
      connectionStatus.parentElement.querySelector('.pulse-dot').style.backgroundColor = 'var(--color-error)';
    } finally {
      // Detener rotación de botón tras pequeña animación
      setTimeout(() => {
        refreshIcon.classList.remove('fa-spin');
      }, 500);
    }
  }

  // --- FUNCIONES DEL LIBRO DE VISITAS ---

  // Obtener todos los mensajes
  async function fetchMessages() {
    try {
      const response = await fetch('/api/messages');
      if (!response.ok) throw new Error('Error al obtener mensajes');
      
      const result = await response.json();
      
      if (result.success) {
        renderMessages(result.data);
      }
    } catch (error) {
      console.error('Error:', error);
      messagesContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation" style="color: var(--color-error)"></i>
          <p>No se pudieron cargar los mensajes.</p>
        </div>
      `;
    }
  }

  // Renderizar mensajes en el DOM
  function renderMessages(messages) {
    messagesCount.textContent = messages.length;

    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-comments-question"></i>
          <p>No hay firmas aún. ¡Sé el primero en dejar un mensaje en SQLite!</p>
        </div>
      `;
      return;
    }

    messagesContainer.innerHTML = messages.map(msg => {
      // Formatear fecha
      const date = new Date(msg.created_at);
      const formattedDate = date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Sanitizar salida para evitar XSS
      const cleanName = escapeHTML(msg.name);
      const cleanText = escapeHTML(msg.message);

      return `
        <article class="message-item">
          <div class="message-meta">
            <span class="message-author">${cleanName}</span>
            <time class="message-date">${formattedDate}</time>
          </div>
          <p class="message-text">${cleanText}</p>
        </article>
      `;
    }).join('');
  }

  // Función para escapar HTML y evitar vulnerabilidades XSS
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Manejar el envío de mensajes
  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = inputName.value.trim();
    const message = inputMessage.value.trim();

    if (!name || !message) return;

    // Deshabilitar botón durante el envío
    submitBtn.disabled = true;
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    btnText.textContent = "Guardando...";

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, message })
      });

      if (!response.ok) throw new Error('Error al guardar');

      const result = await response.json();
      if (result.success) {
        // Limpiar formulario
        inputMessage.value = '';
        
        // Recargar mensajes y telemetría (el tamaño de BD cambia ligeramente)
        await fetchMessages();
        await fetchTelemetry();
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      alert('Hubo un error al guardar tu mensaje en la base de datos.');
    } finally {
      // Reestablecer botón
      submitBtn.disabled = false;
      btnText.textContent = originalText;
    }
  });

  // --- INICIALIZACIÓN ---

  // Event Listeners
  refreshTelemetryBtn.addEventListener('click', fetchTelemetry);

  // Carga inicial
  fetchTelemetry();
  fetchMessages();

  // Actualización automática de telemetría cada 15 segundos
  setInterval(fetchTelemetry, 15000);
});
