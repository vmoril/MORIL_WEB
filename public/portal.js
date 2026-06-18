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

  // Elementos del DOM - Formulario de Leads / Libro
  const messageForm = document.getElementById('message-form');
  const inputName = document.getElementById('input-name');
  const inputEmail = document.getElementById('input-email');
  const inputCompany = document.getElementById('input-company');
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
        cpuModel.title = cpu;
        uptimeEl.textContent = formatUptime(uptime);
        dbType.textContent = database.type;
        dbPath.textContent = database.path.split(/[\\/]/).pop();
        dbPath.title = database.path;

        // RAM stats
        ramPercentage.textContent = memory.percentage;
        ramProgress.style.width = memory.percentage;
        ramUsed.textContent = memory.used;
        ramTotal.textContent = memory.total;

        // Color de la barra según uso
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
      setTimeout(() => {
        refreshIcon.classList.remove('fa-spin');
      }, 500);
    }
  }

  // --- FUNCIONES DEL INBOX DE LEADS ---

  // Obtener todos los mensajes / leads
  async function fetchMessages() {
    try {
      const response = await fetch('/api/messages');
      if (!response.ok) throw new Error('Error al obtener consultas');
      
      const result = await response.json();
      
      if (result.success) {
        renderMessages(result.data);
      }
    } catch (error) {
      console.error('Error:', error);
      messagesContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation" style="color: var(--color-error)"></i>
          <p>No se pudieron cargar las consultas.</p>
        </div>
      `;
    }
  }

  // Renderizar consultas en el DOM
  function renderMessages(messages) {
    messagesCount.textContent = messages.length;

    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-inbox"></i>
          <p>No se han recibido consultas de clientes todavía.</p>
        </div>
      `;
      return;
    }

    messagesContainer.innerHTML = messages.map(msg => {
      const date = new Date(msg.created_at);
      const formattedDate = date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const cleanName = escapeHTML(msg.name);
      const cleanEmail = msg.email ? escapeHTML(msg.email) : '';
      const cleanCompany = msg.company ? escapeHTML(msg.company) : '';
      const cleanText = escapeHTML(msg.message);

      return `
        <article class="message-item">
          <div class="message-meta" style="display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
            <span class="message-author" style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">${cleanName}</span>
            ${cleanCompany ? `<span class="message-company" style="background: rgba(255,255,255,0.05); padding: 0.1rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-light);"><i class="fa-solid fa-building"></i> ${cleanCompany}</span>` : ''}
            ${cleanEmail ? `<span class="message-email" style="background: rgba(255,255,255,0.05); padding: 0.1rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-light);"><i class="fa-solid fa-envelope"></i> <a href="mailto:${cleanEmail}" style="color: var(--color-secondary); text-decoration: none;">${cleanEmail}</a></span>` : ''}
            <time class="message-date" style="margin-left: auto; font-size: 0.8rem; color: var(--text-dim);">${formattedDate}</time>
          </div>
          <p class="message-text" style="color: var(--text-main); white-space: pre-wrap; margin-top: 0.4rem;">${cleanText}</p>
        </article>
      `;
    }).join('');
  }

  // Escapar HTML contra XSS
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Enviar consulta de prueba
  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = inputName.value.trim();
    const email = inputEmail.value.trim();
    const company = inputCompany.value.trim();
    const message = inputMessage.value.trim();

    if (!name || !email || !message) return;

    submitBtn.disabled = true;
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    btnText.textContent = "Registrando...";

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, company, message })
      });

      if (!response.ok) throw new Error('Error al guardar');

      const result = await response.json();
      if (result.success) {
        // Limpiar
        inputName.value = '';
        inputEmail.value = '';
        inputCompany.value = '';
        inputMessage.value = '';
        
        await fetchMessages();
        await fetchTelemetry();
      }
    } catch (error) {
      console.error('Error al enviar:', error);
      alert('Hubo un error al guardar el lead en la base de datos.');
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = originalText;
    }
  });

  // --- INICIALIZACIÓN ---
  refreshTelemetryBtn.addEventListener('click', fetchTelemetry);

  fetchTelemetry();
  fetchMessages();

  // Polling de telemetría cada 15 segundos
  setInterval(fetchTelemetry, 15000);
});
