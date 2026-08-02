const DEFAULT_ORIGIN = 'https://qivessel.com';
const MAX_CHART_CONTEXT = 18000;
const MAX_REQUEST_BODY_BYTES = 8192;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const ROXY_API_BASE = 'https://roxyapi.com/api/v2';
const SHOPIFY_PROXY_MAX_AGE_SECONDS = 5 * 60;
const LOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LOCATION_CACHE_MAX_ENTRIES = 500;
const decoder = new TextDecoder('utf-8');

const readRequestBody = async (request) => {
  const chunks = [];
  let total = 0;
  const reader = request.body?.getReader();
  if (!reader) return '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_REQUEST_BODY_BYTES) {
          await reader.cancel();
          throw Object.assign(new Error('Request body is too large.'), { statusCode: 413 });
        }
        chunks.push(value);
      }
    }
  } catch (error) {
    if (error?.statusCode) throw error;
    throw Object.assign(new Error('Unable to read request body.'), { statusCode: 400 });
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return decoder.decode(buffer);
};

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    ...headers
  }
});

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error || 'Unknown error');

const fetchJsonWithRetry = async (
  url,
  options,
  { timeoutMs, attempts = 1, label = 'Upstream service' }
) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const declaredLength = Number(response.headers.get('Content-Length') || 0);
      if (declaredLength > MAX_RESPONSE_BYTES) {
        const tooLargeError = new Error(`${label} response is too large.`);
        tooLargeError.retryable = false;
        throw tooLargeError;
      }
      const bytes = await response.arrayBuffer();
      const text = decoder.decode(bytes.slice(0, MAX_RESPONSE_BYTES));

      if (!response.ok) {
        let detail = text.slice(0, 180);
        try {
          const data = JSON.parse(text);
          detail = data?.error || data?.message || detail;
        } catch {
          // Non-JSON error body; keep the raw text detail.
        }
        const serviceError = new Error(
          `${label} returned ${response.status}${detail ? `: ${detail}` : ''}`
        );
        serviceError.retryable =
          response.status === 408 || response.status === 429 || response.status >= 500;
        throw serviceError;
      }

      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          const invalidJsonError = new Error(`${label} returned invalid JSON.`);
          invalidJsonError.retryable = true;
          throw invalidJsonError;
        }
      }

      if (!data) {
        const emptyResponseError = new Error(`${label} returned an empty response.`);
        emptyResponseError.retryable = true;
        throw emptyResponseError;
      }

      return data;
    } catch (error) {
      const normalizedError =
        error?.name === 'AbortError'
          ? Object.assign(new Error(`${label} timed out.`), { retryable: true })
          : error;
      lastError = normalizedError;

      if (attempt >= attempts || normalizedError?.retryable === false) {
        throw normalizedError;
      }
    } finally {
      clearTimeout(timeout);
    }

    await wait(250 * attempt);
  }

  throw lastError;
};

const corsHeaders = (request, env) => {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).split(',').map((value) => value.trim());
  if (!origin || !allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
};

const encoder = new TextEncoder();

const toHex = (buffer) => Array.from(new Uint8Array(buffer))
  .map((value) => value.toString(16).padStart(2, '0'))
  .join('');

const secureEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
};

const shopifyProxySignatureIsValid = async (request, env) => {
  if (!env.SHOPIFY_API_SECRET) return false;

  const url = new URL(request.url);
  const signature = url.searchParams.get('signature');
  const timestamp = Number(url.searchParams.get('timestamp'));
  const shop = url.searchParams.get('shop');

  if (!signature || !Number.isFinite(timestamp) || !shop) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > SHOPIFY_PROXY_MAX_AGE_SECONDS) return false;
  if (env.SHOPIFY_SHOP_DOMAIN && shop !== env.SHOPIFY_SHOP_DOMAIN) return false;

  const grouped = new Map();
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'signature') continue;
    grouped.set(key, [...(grouped.get(key) || []), value]);
  }
  const message = Array.from(grouped.entries())
    .map(([key, values]) => `${key}=${values.join(',')}`)
    .sort()
    .join('');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.SHOPIFY_API_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return secureEqual(toHex(digest), signature);
};

const requestHeaders = async (request, env) => {
  const cors = corsHeaders(request, env);
  if (cors) return cors;
  if (await shopifyProxySignatureIsValid(request, env)) return {};
  return null;
};

const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
};

const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const validReading = (payload) => {
  const reading = {
    name: cleanText(payload?.name, 80),
    birth_date: cleanText(payload?.birth_date, 10),
    birth_time: cleanText(payload?.birth_time, 5),
    birth_place: cleanText(payload?.birth_place, 180),
    email: cleanText(payload?.email, 254)
  };
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reading.email);
  if (
    !reading.name ||
    !isValidDate(reading.birth_date) ||
    !isValidTime(reading.birth_time) ||
    !reading.birth_place ||
    !emailIsValid
  ) return null;
  return reading;
};

// In-isolate cache so repeat requests for the same city don't hit the
// upstream location API (saves latency and quota). Not durable across
// isolates, which is fine: it is only a performance optimization.
const locationCache = new Map();

const getBirthLocation = async (birthPlace, env) => {
  if (!env.ROXY_API_KEY) throw new Error('RoxyAPI is not configured.');
  const cacheKey = birthPlace.trim().toLowerCase();
  const cached = locationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL(`${ROXY_API_BASE}/location/search`);
  url.searchParams.set('q', birthPlace);
  url.searchParams.set('limit', '1');

  const data = await fetchJsonWithRetry(
    url,
    {
      headers: { 'X-API-Key': env.ROXY_API_KEY }
    },
    {
      timeoutMs: 5000,
      attempts: 2,
      label: 'Birthplace lookup'
    }
  );
  const place = data?.cities?.[0];
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!place || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !place.timezone) {
    throw Object.assign(new Error('Birthplace not found.'), { statusCode: 400 });
  }
  const value = { ...place, latitude, longitude };
  if (locationCache.size >= LOCATION_CACHE_MAX_ENTRIES) locationCache.clear();
  locationCache.set(cacheKey, { value, expiresAt: Date.now() + LOCATION_CACHE_TTL_MS });
  return value;
};

const utcOffsetAtBirth = (date, time, timeZone) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(localAsUtc));
  const value = (kind) => Number(parts.find((part) => part.type === kind)?.value);
  const zonedAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'));
  return (zonedAsUtc - localAsUtc) / 3600000;
};

const requestNatalChart = async (reading, location, env) => {
  const timezone = utcOffsetAtBirth(reading.birth_date, reading.birth_time, location.timezone);
  return fetchJsonWithRetry(
    `${ROXY_API_BASE}/astrology/natal-chart?lang=en`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.ROXY_API_KEY
      },
      body: JSON.stringify({
        date: reading.birth_date,
        time: `${reading.birth_time}:00`,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone,
        houseSystem: 'placidus'
      })
    },
    {
      timeoutMs: 7000,
      attempts: 2,
      label: 'Natal-chart service'
    }
  );
};

const createReading = async (reading, natalChart, env) => {
  if (!env.DEEPSEEK_API_KEY) throw new Error('DeepSeek is not configured.');

  const chartContext = JSON.stringify(natalChart).slice(0, MAX_CHART_CONTEXT);
  const data = await fetchJsonWithRetry(
    'https://api.deepseek.com/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.7,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You write ethical, entertainment-focused Western astrology readings in polished American English. Lead with recognition, then name a gentle present-day tension and offer a simple reflective ritual. Do not claim certainty, diagnose, promise outcomes, create fear, use urgency, or give medical, legal, or financial advice. A bracelet is only a symbolic, optional daily reminder, never a cure or guarantee. Use only natal-chart data supplied by the user. Return valid JSON only, with no Markdown and no code fences.'
        },
        {
          role: 'user',
          content: `Create a concise, warm personalized reading for ${reading.name}. The flow must feel like: recognition → a gentle current-life friction → a small self-led practice → an optional symbolic bracelet reminder. Never use fear, scarcity, certainty, or manipulation. Return exactly this JSON shape:\n{\n  "archetype":"short poetic archetype, max 6 words",\n  "title":"a personal report title, max 8 words",\n  "opening":"a resonant 2-sentence insight, max 55 words",\n  "big_three":[\n    {"label":"Sun","sign":"sign name","meaning":"one practical sentence"},\n    {"label":"Moon","sign":"sign name","meaning":"one practical sentence"},\n    {"label":"Rising","sign":"sign name","meaning":"one practical sentence"}\n  ],\n  "tension":{"title":"short current-life tension title","body":"2 concise sentences that name a relatable friction without fear, max 65 words"},\n  "cost_now":["short realistic consequence 1, max 14 words","short realistic consequence 2, max 14 words","short realistic consequence 3, max 14 words"],\n  "ritual":{"intention":"short daily intention","practice":"one simple reflective practice, max 35 words","bracelet_cue":"one tactile, optional wearing cue, max 24 words"},\n  "bracelet":{"title":"A symbolic bracelet intention","crystals":["crystal 1","crystal 2","crystal 3"],"reason":"2 concise sentences about symbolic resonance, never a promise","ritual":"one optional, grounded moment to touch or notice the bracelet, max 24 words","cta_label":"EXPLORE YOUR ALIGNED BRACELETS"},\n  "disclaimer":"For reflection and personal inspiration. Your path is always your own."\n}\n\nBirth data: ${JSON.stringify(reading)}\n\nNatal-chart provider response: ${chartContext}`
        }
      ]
      })
    },
    {
      timeoutMs: 12000,
      attempts: 1,
      label: 'DeepSeek interpretation'
    }
  );
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('The interpretation service returned no reading.');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The interpretation service returned an invalid reading.');
  }
};

export default {
  async fetch(request, env) {
    const headers = await requestHeaders(request, env);
    if (!headers) return json({ error: 'Unauthorized request.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const pathname = new URL(request.url).pathname;
    // Direct Worker calls use /reading; Shopify App Proxy forwards as /apps/reading.
    const readingPaths = ['/reading', '/apps/reading'];

    if (request.method === 'GET' && readingPaths.includes(pathname)) {
      return json({ status: 'Qi Reading Proxy is ready.' }, 200, headers);
    }
    if (request.method !== 'POST' || !readingPaths.includes(pathname)) {
      return json({ error: 'Not found.' }, 404, headers);
    }

    try {
      const contentType = request.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        return json({ error: 'Content-Type must be application/json.' }, 415, headers);
      }
      const contentLength = Number(request.headers.get('Content-Length') || 0);
      if (contentLength > MAX_REQUEST_BODY_BYTES) {
        return json({ error: 'Request body is too large.' }, 413, headers);
      }

      let bodyText;
      try {
        bodyText = await readRequestBody(request);
      } catch (error) {
        return json({ error: errorMessage(error) }, error?.statusCode || 400, headers);
      }
      let payload;
      try {
        payload = JSON.parse(bodyText);
      } catch {
        return json({ error: 'Request body must be valid JSON.' }, 400, headers);
      }
      const reading = validReading(payload);
      if (!reading) return json({ error: 'Please provide valid birth details and email.' }, 400, headers);

      console.info('Reading: resolving birthplace.');
      const location = await getBirthLocation(reading.birth_place, env);
      console.info('Reading: calculating natal chart.');
      const natalChart = await requestNatalChart(reading, location, env);
      console.info('Reading: generating interpretation.');
      const profile = await createReading(reading, natalChart, env);
      console.info('Reading: completed.');
      return json({
        message: 'Your astral profile is ready.',
        profile,
        location: `${location.city}${location.country ? `, ${location.country}` : ''}`
      }, 200, headers);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Unknown reading error');
      const statusCode = error?.statusCode || 502;
      return json(
        { error: statusCode === 400 ? error.message : 'The stars are briefly obscured. Please try again in a moment.' },
        statusCode,
        headers
      );
    }
  }
};
