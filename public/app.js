document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.getElementById('contact-form');
  const leadName = document.getElementById('lead-name');
  const leadEmail = document.getElementById('lead-email');
  const leadCompany = document.getElementById('lead-company');
  const leadMessage = document.getElementById('lead-message');
  const submitBtn = document.getElementById('submit-lead-btn');
  const formFeedback = document.getElementById('form-feedback');

  // Smooth scrolling para enlaces internos con anclas
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = leadName.value.trim();
      const email = leadEmail.value.trim();
      const company = leadCompany.value.trim();
      const message = leadMessage.value.trim();

      if (!name || !email || !message) return;

      // Deshabilitar botón durante el envío
      submitBtn.disabled = true;
      const btnText = submitBtn.querySelector('.btn-text');
      const originalText = btnText.textContent;
      btnText.textContent = "Enviando...";

      // Ocultar feedback previo
      formFeedback.style.display = 'none';

      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, email, company, message })
        });

        if (!response.ok) throw new Error('Error en el servidor al enviar consulta.');

        const result = await response.json();
        if (result.success) {
          formFeedback.style.display = 'block';
          formFeedback.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
          formFeedback.style.border = '1px solid var(--color-success)';
          formFeedback.style.color = 'var(--color-success)';
          formFeedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> ¡Muchas gracias, ${name}! Hemos recibido tu consulta. Nos pondremos en contacto contigo a la brevedad.`;
          
          // Reiniciar formulario
          contactForm.reset();
        } else {
          throw new Error(result.error || 'Error al procesar el mensaje.');
        }
      } catch (error) {
        console.error('Error al enviar formulario:', error);
        formFeedback.style.display = 'block';
        formFeedback.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        formFeedback.style.border = '1px solid var(--color-error)';
        formFeedback.style.color = 'var(--color-error)';
        formFeedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error: No se pudo enviar tu consulta. Inténtalo de nuevo más tarde o escríbenos directamente a <strong>vicente@moril.tech</strong>.`;
      } finally {
        submitBtn.disabled = false;
        btnText.textContent = originalText;
      }
    });
  }
});
