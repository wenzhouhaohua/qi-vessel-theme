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
    const ritualLoading = root.querySelector('[data-ritual-loading]');
    const readingResult = root.querySelector('[data-reading-result]');
    const readingReport = root.querySelector('[data-reading-report]');
    const readingLocation = root.querySelector('[data-reading-location]');

    const showRitualLoading = () => {
      ritualLoading?.removeAttribute('hidden');
      readingResult?.setAttribute('hidden', '');
    };

    const showReadingResult = (result) => {
      ritualLoading?.setAttribute('hidden', '');
      if (readingReport) readingReport.textContent = result.report || result.message || '';
      if (readingLocation) readingLocation.textContent = result.location ? `Birthplace resolved as ${result.location}` : '';
      readingResult?.removeAttribute('hidden');
    };

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
        root.style.setProperty('--qi-x', `${x * 16}px`);
        root.style.setProperty('--qi-y', `${y * 11}px`);
        root.style.setProperty('--qi-oracle-x', `${x * 12}px`);
        root.style.setProperty('--qi-oracle-y', `${y * 8}px`);
      }, { passive: true });
    }

    if (!window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let touchFrame;
      let touchReset;
      const setMobileDepth = (clientX, clientY) => {
        const rect = root.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, ((clientX - rect.left) / rect.width - .5) * 2));
        const y = Math.max(-1, Math.min(1, ((clientY - rect.top) / rect.height - .5) * 2));
        root.style.setProperty('--qi-mobile-x', `${x * 10}px`);
        root.style.setProperty('--qi-mobile-y', `${y * 7}px`);
        root.style.setProperty('--qi-mobile-panel-x', `${x * -3}px`);
        root.style.setProperty('--qi-mobile-panel-y', `${y * -2}px`);
      };

      const updateMobileMotion = () => {
        const rect = root.getBoundingClientRect();
        const middle = rect.top + rect.height / 2;
        const viewportMiddle = window.innerHeight / 2;
        const progress = Math.max(-1, Math.min(1, (middle - viewportMiddle) / window.innerHeight));
        root.style.setProperty('--qi-mobile-shift', `${progress * -18}px`);
      };

      window.addEventListener('scroll', updateMobileMotion, { passive: true });
      updateMobileMotion();
      root.addEventListener('pointerdown', (event) => {
        setMobileDepth(event.clientX, event.clientY);
        root.classList.add('is-touch-lit');
        window.clearTimeout(touchReset);
        touchReset = window.setTimeout(() => root.classList.remove('is-touch-lit'), 1100);
      }, { passive: true });
      root.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'touch') return;
        window.cancelAnimationFrame(touchFrame);
        touchFrame = window.requestAnimationFrame(() => setMobileDepth(event.clientX, event.clientY));
      }, { passive: true });
      root.addEventListener('pointerup', () => {
        window.clearTimeout(touchReset);
        touchReset = window.setTimeout(() => {
          root.classList.remove('is-touch-lit');
          root.style.setProperty('--qi-mobile-x', '0px');
          root.style.setProperty('--qi-mobile-y', '0px');
          root.style.setProperty('--qi-mobile-panel-x', '0px');
          root.style.setProperty('--qi-mobile-panel-y', '0px');
        }, 520);
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
      let keepDialogOpen = false;
      stage.textContent = stages[index];
      showRitualLoading();
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
          else if (result.report) {
            showReadingResult(result);
            keepDialogOpen = true;
            status.textContent = 'Your astral profile is ready.';
          } else status.textContent = result.message || 'Your astral profile is ready.';
        } else {
          await new Promise((resolve) => window.setTimeout(resolve, 2700));
          status.textContent = `Thank you, ${payload.name}. Your sacred profile has been received.`;
        }
      } catch (error) {
        status.textContent = 'The stars are briefly obscured. Please try again in a moment.';
      } finally {
        window.clearInterval(stageTimer);
        if (!keepDialogOpen) dialog?.close();
      }
    });
  };

  const initAll = (scope = document) => scope.querySelectorAll('[data-qi-sacred]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll());
  else initAll();
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
})();
