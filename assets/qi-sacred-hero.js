(() => {
  const init = (root) => {
    if (!root || root.dataset.qiReady === 'true') return;
    root.dataset.qiReady = 'true';

    const panel = root.querySelector('[data-reading-panel]');
    const openButtons = root.querySelectorAll('[data-open-reading]');
    const menuToggle = root.querySelector('[data-menu-toggle]');
    const menu = root.querySelector('[data-menu]');
    const form = root.querySelector('[data-astral-form]');
    const status = root.querySelector('[data-form-status]');
    const dialog = root.querySelector('[data-ritual-dialog]');
    const stage = root.querySelector('[data-ritual-stage]');
    const closeDialog = root.querySelector('[data-close-ritual]');

    openButtons.forEach((button) => button.addEventListener('click', () => {
      panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => panel?.querySelector('input')?.focus({ preventScroll: true }), 650);
    }));

    menuToggle?.addEventListener('click', () => {
      const open = menu?.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(Boolean(open)));
    });

    menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      menu.classList.remove('is-open');
      menuToggle?.setAttribute('aria-expanded', 'false');
    }));

    closeDialog?.addEventListener('click', () => dialog?.close());

    if (window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.addEventListener('pointermove', (event) => {
        const rect = root.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - .5);
        const y = ((event.clientY - rect.top) / rect.height - .5);
        root.style.setProperty('--qi-x', `${x * 10}px`);
        root.style.setProperty('--qi-y', `${y * 7}px`);
        root.style.setProperty('--qi-oracle-x', `${x * 6}px`);
        root.style.setProperty('--qi-oracle-y', `${y * 4}px`);
      }, { passive: true });
    }

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      status.textContent = '';

      if (!form.checkValidity()) {
        form.reportValidity();
        status.textContent = 'Please complete each sacred detail before continuing.';
        return;
      }

      const payload = Object.fromEntries(new FormData(form).entries());
      const endpoint = root.dataset.apiEndpoint?.trim();
      const stages = ['ALIGNING YOUR CELESTIAL PATTERNS…', 'READING YOUR ENERGY SIGNATURE…', 'PREPARING YOUR SACRED MAP…'];
      let index = 0;
      stage.textContent = stages[index];
      dialog?.showModal();
      const stageTimer = window.setInterval(() => {
        index = (index + 1) % stages.length;
        stage.textContent = stages[index];
      }, 1200);

      try {
        if (endpoint) {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error('Reading service unavailable');
          const result = await response.json();
          if (result.redirect_url) window.location.assign(result.redirect_url);
          else status.textContent = result.message || 'Your astral profile is ready.';
        } else {
          await new Promise((resolve) => window.setTimeout(resolve, 2700));
          status.textContent = `Thank you, ${payload.name}. Your sacred profile has been received.`;
        }
      } catch (error) {
        status.textContent = 'The stars are briefly obscured. Please try again in a moment.';
      } finally {
        window.clearInterval(stageTimer);
        dialog?.close();
      }
    });
  };

  const initAll = (scope = document) => scope.querySelectorAll('[data-qi-sacred]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll());
  else initAll();
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
})();
