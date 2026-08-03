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
    const readingLocation = root.querySelector('[data-reading-location]');
    const readingArchetype = root.querySelector('[data-reading-archetype]');
    const readingTitle = root.querySelector('[data-reading-title]');
    const readingOpening = root.querySelector('[data-reading-opening]');
    const readingBigThree = root.querySelector('[data-reading-big-three]');
  const attentionTitle = root.querySelector('[data-reading-attention-title]');
  const attentionBody = root.querySelector('[data-reading-attention-body]');
  const tensionTitle = root.querySelector('[data-reading-tension-title]');
  const tensionBody = root.querySelector('[data-reading-tension-body]');
  const readingCostSection = root.querySelector('[data-reading-cost-section]');
  const readingCostList = root.querySelector('[data-reading-cost-list]');
    const ritualIntention = root.querySelector('[data-reading-ritual-intention]');
    const ritualPractice = root.querySelector('[data-reading-ritual-practice]');
    const braceletTitle = root.querySelector('[data-reading-bracelet-title]');
  const braceletReason = root.querySelector('[data-reading-bracelet-reason]');
  const braceletRitual = root.querySelector('[data-reading-bracelet-ritual]');
  const braceletRitualWrap = root.querySelector('[data-reading-bracelet-ritual-wrap]');
    const readingCrystals = root.querySelector('[data-reading-crystals]');
    const readingCta = root.querySelector('[data-reading-cta]');
    const readingNote = root.querySelector('[data-reading-note]');
    const finePointer = window.matchMedia('(pointer:fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const showRitualLoading = () => {
      ritualLoading?.classList.remove('is-error');
      ritualLoading?.removeAttribute('hidden');
      readingResult?.setAttribute('hidden', '');
    };

    const showReadingResult = (result) => {
      const profile = result.profile || {};
      ritualLoading?.setAttribute('hidden', '');
      if (readingArchetype) readingArchetype.textContent = profile.archetype || 'YOUR CELESTIAL SIGNATURE';
      if (readingTitle) readingTitle.textContent = profile.title || 'Your Astral Profile';
      if (readingLocation) readingLocation.textContent = result.location ? `Birthplace resolved as ${result.location}` : '';
      if (readingOpening) readingOpening.textContent = profile.opening || result.report || result.message || '';
      if (attentionTitle) attentionTitle.textContent = profile.attention?.title || 'What Wants Your Attention';
      if (attentionBody) attentionBody.textContent = profile.attention?.body || '';
      if (tensionTitle) tensionTitle.textContent = profile.tension?.title || profile.attention?.title || 'Where Your Energy Leaks';
      if (tensionBody) tensionBody.textContent = profile.tension?.body || profile.attention?.body || '';

      if (readingCostList) {
        readingCostList.replaceChildren();
        const costs = Array.isArray(profile.cost_now) ? profile.cost_now.slice(0, 3) : [];
        costs.forEach((cost) => {
          const item = document.createElement('li');
          item.textContent = cost;
          readingCostList.append(item);
        });
        if (readingCostSection) readingCostSection.hidden = !readingCostList.childElementCount;
      }
      if (ritualIntention) ritualIntention.textContent = profile.ritual?.intention || 'Return to your own rhythm.';
      if (ritualPractice) ritualPractice.textContent = profile.ritual?.practice || '';
      if (braceletTitle) braceletTitle.textContent = profile.bracelet?.title || 'Your Aligned Bracelet';
      if (braceletReason) braceletReason.textContent = profile.bracelet?.reason || '';
      const braceletCue = profile.bracelet?.ritual || profile.ritual?.bracelet_cue || '';
      if (braceletRitual) braceletRitual.textContent = braceletCue;
      if (braceletRitualWrap) braceletRitualWrap.hidden = !braceletCue;
      if (readingNote) readingNote.textContent = profile.disclaimer || 'For reflection and personal inspiration. Your path is always your own.';
      if (readingCta) {
        const label = document.createTextNode(profile.bracelet?.cta_label || 'EXPLORE YOUR ALIGNED BRACELETS');
        const icon = document.createElement('span');
        icon.textContent = '＋';
        readingCta.replaceChildren(label, icon);
      }
      if (readingBigThree) {
        readingBigThree.replaceChildren();
        (profile.big_three || []).slice(0, 3).forEach((item) => {
          const card = document.createElement('article');
          const label = document.createElement('small');
          const sign = document.createElement('strong');
          const meaning = document.createElement('p');
          label.textContent = item.label || 'Celestial key';
          sign.textContent = item.sign || '—';
          meaning.textContent = item.meaning || '';
          card.append(label, sign, meaning);
          readingBigThree.append(card);
        });
      }
      if (readingCrystals) {
        readingCrystals.replaceChildren();
        (profile.bracelet?.crystals || []).slice(0, 3).forEach((crystal) => {
          const chip = document.createElement('span');
          chip.textContent = crystal;
          readingCrystals.append(chip);
        });
      }
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

    if (finePointer && !reducedMotion) {
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

    if (!finePointer && !reducedMotion) {
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

    const fetchReading = async (endpoint, payload) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 55000);

      try {
        const requestUrl = new URL(endpoint, window.location.href).toString();
        const response = await fetch(requestUrl, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'follow',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        const contentType = response.headers.get('content-type') || '';
        const result = contentType.includes('application/json')
          ? await response.json()
          : { error: (await response.text()).slice(0, 180) };

        if (!response.ok) {
          const error = new Error(result.error || `Reading service unavailable (${response.status})`);
          error.status = response.status;
          throw error;
        }

        return result;
      } finally {
        window.clearTimeout(timeout);
      }
    };

    // ---- Birthplace city picker ----
    // Lets visitors search RoxyAPI's canonical city list and lock the exact
    // coordinates/timezone for the chosen city, so the reading no longer
    // depends on fuzzy free-text matching (e.g. "New York" -> Albany).
    const placeField = root.querySelector('[data-place-field]');
    const placeInput = root.querySelector('[data-place-input]');
    const placeList = root.querySelector('[data-place-list]');
    const placeNote = root.querySelector('[data-place-note]');
    const placeLat = root.querySelector('[data-place-lat]');
    const placeLng = root.querySelector('[data-place-lng]');
    const placeTz = root.querySelector('[data-place-tz]');
    const locationsEndpoint = root.dataset.locationsEndpoint?.trim() || '';

    let placeOptions = [];
    let placeActiveIndex = -1;
    let placeRequestId = 0;
    let placeTimer = null;
    let placeAbort = null;

    const closePlaceList = () => {
      placeOptions = [];
      placeActiveIndex = -1;
      if (placeList) placeList.hidden = true;
      placeInput?.setAttribute('aria-expanded', 'false');
      placeInput?.removeAttribute('aria-activedescendant');
    };

    const clearPlaceSelection = () => {
      if (placeLat) placeLat.value = '';
      if (placeLng) placeLng.value = '';
      if (placeTz) placeTz.value = '';
      if (placeNote) {
        placeNote.hidden = true;
        placeNote.classList.remove('is-ok');
        placeNote.textContent = '';
      }
    };

    const selectPlace = (item) => {
      if (!item) return;
      if (placeInput) placeInput.value = item.label;
      if (placeLat) placeLat.value = item.lat ?? '';
      if (placeLng) placeLng.value = item.lng ?? '';
      if (placeTz) placeTz.value = item.tz ?? '';
      closePlaceList();
      if (placeNote) {
        placeNote.textContent = `Selected: ${item.label}`;
        placeNote.classList.add('is-ok');
        placeNote.hidden = false;
      }
    };

    const renderPlaceOptions = (items) => {
      if (!placeList) return;
      placeOptions = items || [];
      placeActiveIndex = -1;
      placeList.replaceChildren();
      if (!placeOptions.length) {
        const empty = document.createElement('div');
        empty.className = 'qi-sacred__place-empty';
        empty.textContent = 'No exact match found — you can still continue typing your city.';
        placeList.append(empty);
      } else {
        placeOptions.forEach((item, index) => {
          const option = document.createElement('button');
          option.type = 'button';
          option.className = 'qi-sacred__place-option';
          option.setAttribute('role', 'option');
          option.id = `${placeList.id}-option-${index}`;
          option.textContent = item.label;
          option.addEventListener('mousedown', (event) => event.preventDefault());
          option.addEventListener('click', () => selectPlace(item));
          placeList.append(option);
        });
      }
      placeList.hidden = false;
      placeInput?.setAttribute('aria-expanded', 'true');
    };

    const movePlaceActive = (delta) => {
      if (!placeOptions.length || !placeList || placeList.hidden) return;
      placeActiveIndex = (placeActiveIndex + delta + placeOptions.length) % placeOptions.length;
      const options = placeList.querySelectorAll('[role="option"]');
      options.forEach((option, index) => {
        option.classList.toggle('is-active', index === placeActiveIndex);
        if (index === placeActiveIndex) option.setAttribute('aria-selected', 'true');
        else option.removeAttribute('aria-selected');
      });
      if (options[placeActiveIndex]) {
        placeInput?.setAttribute('aria-activedescendant', options[placeActiveIndex].id);
        options[placeActiveIndex].scrollIntoView({ block: 'nearest' });
      }
    };

    const searchPlaces = async (query) => {
      if (!locationsEndpoint || !placeInput || !placeList) return;
      const requestId = ++placeRequestId;
      placeAbort?.abort();
      const controller = new AbortController();
      placeAbort = controller;
      try {
        const url = new URL(locationsEndpoint, window.location.href);
        url.searchParams.set('q', query);
        url.searchParams.set('limit', '8');
        const response = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        if (requestId !== placeRequestId) return;
        if (!response.ok) throw new Error(`City search failed (${response.status})`);
        const data = await response.json();
        if (requestId !== placeRequestId) return;
        const items = (data.cities || []).map((city) => ({
          label: city.label || `${city.city || ''}${city.country ? `, ${city.country}` : ''}`,
          lat: Number(city.latitude),
          lng: Number(city.longitude),
          tz: city.timezone || ''
        })).filter((city) => city.label);
        renderPlaceOptions(items);
      } catch (error) {
        if (error?.name === 'AbortError' || requestId !== placeRequestId) return;
        closePlaceList();
        if (placeNote) {
          placeNote.textContent = 'City search is unavailable — you can enter your city manually.';
          placeNote.hidden = false;
        }
      }
    };

    if (placeInput && placeList) {
      placeInput.addEventListener('input', () => {
        clearPlaceSelection();
        closePlaceList();
        const query = placeInput.value.trim();
        if (query.length < 2) return;
        window.clearTimeout(placeTimer);
        placeTimer = window.setTimeout(() => searchPlaces(query), 260);
      });

      placeInput.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          movePlaceActive(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          movePlaceActive(-1);
        } else if (event.key === 'Enter') {
          if (!placeList.hidden && placeOptions[placeActiveIndex]) {
            event.preventDefault();
            selectPlace(placeOptions[placeActiveIndex]);
          }
        } else if (event.key === 'Escape') {
          event.preventDefault();
          closePlaceList();
        } else if (event.key === 'Tab') {
          closePlaceList();
        }
      });

      placeInput.addEventListener('blur', () => {
        window.clearTimeout(placeTimer);
        window.setTimeout(closePlaceList, 120);
      });
    }

    document.addEventListener('pointerdown', (event) => {
      if (placeField && !placeField.contains(event.target)) closePlaceList();
    }, { passive: true });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (status) status.textContent = '';

      if (!form.checkValidity()) {
        form.reportValidity();
        if (status) status.textContent = 'Please complete each sacred detail before continuing.';
        return;
      }

      const payload = Object.fromEntries(new FormData(form).entries());
      // Prefer a same-origin relative path (works on mobile/desktop without
      // relying on direct workers.dev reachability from the visitor's network).
      const configuredEndpoint = root.dataset.apiEndpoint?.trim() || '';
      const endpoint = configuredEndpoint.startsWith('/') ? configuredEndpoint : '/apps/reading';
      const submitButton = form.querySelector('[type="submit"]');
      const stages = ['ALIGNING YOUR CELESTIAL PATTERNS…', 'READING YOUR ENERGY SIGNATURE…', 'PREPARING YOUR SACRED MAP…'];
      let index = 0;
      let keepDialogOpen = false;
      if (stage) stage.textContent = stages[index];
      showRitualLoading();
      dialog?.showModal();
      if (submitButton) submitButton.disabled = true;
      const stageTimer = window.setInterval(() => {
        index = (index + 1) % stages.length;
        if (stage) stage.textContent = stages[index];
      }, 1200);

      try {
        if (endpoint) {
          const result = await fetchReading(endpoint, payload);
          if (result.redirect_url) window.location.assign(result.redirect_url);
          else if (result.profile || result.report) {
            showReadingResult(result);
            keepDialogOpen = true;
            if (status) status.textContent = 'Your astral profile is ready.';
          } else if (status) status.textContent = result.message || 'Your astral profile is ready.';
        } else {
          await new Promise((resolve) => window.setTimeout(resolve, 2700));
          if (status) status.textContent = `Thank you, ${payload.name}. Your sacred profile has been received.`;
        }
      } catch (error) {
        console.error('Qi reading request failed:', error);
        const message = error?.name === 'AbortError'
          ? 'This reading is taking longer than expected. Please try again in a moment.'
          : 'The stars are briefly obscured. Please try again in a moment.';
        if (status) status.textContent = message;
        if (stage) stage.textContent = message;
        ritualLoading?.classList.add('is-error');
        keepDialogOpen = true;
      } finally {
        window.clearInterval(stageTimer);
        if (submitButton) submitButton.disabled = false;
        if (!keepDialogOpen) dialog?.close();
      }
    });
  };

  const initAll = (scope = document) => scope.querySelectorAll('[data-qi-sacred]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll());
  else initAll();
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
})();
