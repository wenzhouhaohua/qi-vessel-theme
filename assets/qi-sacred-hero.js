class QiVisualLock {
  constructor(root) {
    this.root = root;
    this.form = root.querySelector('[data-astral-form]');
    this.dialog = root.querySelector('[data-ritual-dialog]');
    this.status = root.querySelector('[data-form-status]');
    this.endpoint = root.dataset.apiEndpoint || '';
    root.querySelector('[data-open-reading]')?.addEventListener('click', () => {
      root.querySelector('input[name="name"]')?.focus({ preventScroll: true });
    });
    root.querySelector('[data-close-ritual]')?.addEventListener('click', () => this.dialog?.close());
    this.form?.addEventListener('submit', (event) => this.submit(event));
  }

  async submit(event) {
    event.preventDefault();
    if (!this.form.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(this.form));
    this.dialog?.showModal();
    try {
      if (this.endpoint) {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Unable to begin your reading.');
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1400));
      }
      if (this.status) this.status.textContent = 'Your astral profile is ready.';
      const stage = this.dialog?.querySelector('[data-ritual-stage]');
      if (stage) stage.textContent = 'YOUR ENERGY MAP IS READY';
    } catch (error) {
      if (this.status) this.status.textContent = error.message;
      this.dialog?.close();
    }
  }
}

document.querySelectorAll('[data-qi-visual-lock]').forEach((root) => new QiVisualLock(root));
