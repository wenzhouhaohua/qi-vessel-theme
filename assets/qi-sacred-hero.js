(() => {
  const stages = [
    'ALIGNING YOUR CELESTIAL PATTERNS…',
    'INTERPRETING YOUR ENERGY SIGNATURE…',
    'DISCOVERING YOUR CRYSTAL CONNECTION…'
  ];

  document.querySelectorAll('[data-qi-sacred]').forEach((root) => {
    const openButton = root.querySelector('[data-open-reading]');
    const panel = root.querySelector('[data-reading-panel]');
    const form = root.querySelector('[data-astral-form]');
    const status = root.querySelector('[data-form-status]');
    const dialog = root.querySelector('[data-ritual-dialog]');
    const dialogStage = root.querySelector('[data-ritual-stage]');
    const close = root.querySelector('[data-close-ritual]');
    const endpoint = root.dataset.apiEndpoint || '';

    openButton?.addEventListener('click', () => panel?.scrollIntoView({behavior:'smooth',block:'center'}));
    close?.addEventListener('click', () => dialog?.close());

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form).entries());
      status.textContent = '';
      if (dialog?.showModal) dialog.showModal();
      let stage = 0;
      dialogStage.textContent = stages[0];
      const timer = setInterval(() => {
        stage = Math.min(stage + 1, stages.length - 1);
        dialogStage.textContent = stages[stage];
      }, 1100);

      try {
        if (endpoint) {
          const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
          if (!response.ok) throw new Error('The reading service is temporarily unavailable.');
          const result = await response.json();
          sessionStorage.setItem('qiAstralResult', JSON.stringify(result));
          window.location.assign('/pages/astral-result');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 3300));
        status.textContent = 'Your profile is ready for the secure AI connection.';
      } catch (error) {
        status.textContent = error.message || 'Please try again.';
      } finally {
        clearInterval(timer);
        dialog?.close();
      }
    });
  });
})();
