const DEFAULT_ORIGIN = 'https://qivessel.com';
const MAX_CHART_CONTEXT = 18000;
const ROXY_API_BASE = 'https://roxyapi.com/api/v2';

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=UTF-8', ...headers }
});

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

const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const validReading = (payload) => {
  const reading = {
    name: cleanText(payload?.name, 80),
    birth_date: cleanText(payload?.birth_date, 10),
    birth_time: cleanText(payload?.birth_time, 5),
    birth_place: cleanText(payload?.birth_place, 180),
    email: cleanText(payload?.email, 254)
  };
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reading.email);
  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(reading.birth_date);
  const timeIsValid = /^\d{2}:\d{2}$/.test(reading.birth_time);
  if (!reading.name || !dateIsValid || !timeIsValid || !reading.birth_place || !emailIsValid) return null;
  return reading;
};

const getBirthLocation = async (birthPlace, env) => {
  if (!env.ROXY_API_KEY) throw new Error('RoxyAPI is not configured.');
  const url = new URL(`${ROXY_API_BASE}/location/search`);
  url.searchParams.set('q', birthPlace);
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: { 'X-API-Key': env.ROXY_API_KEY }
  });
  if (!response.ok) throw new Error('The birthplace lookup service is unavailable.');

  const data = await response.json();
  const place = data?.cities?.[0];
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!place || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !place.timezone) {
    throw new Error('Birthplace not found.');
  }
  return { ...place, latitude, longitude };
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
  const response = await fetch(`${ROXY_API_BASE}/astrology/natal-chart?lang=en`, {
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
  });

  if (!response.ok) throw new Error('The natal-chart service is unavailable.');
  return response.json();
};

const createReading = async (reading, natalChart, env) => {
  if (!env.DEEPSEEK_API_KEY) throw new Error('DeepSeek is not configured.');

  const chartContext = JSON.stringify(natalChart).slice(0, MAX_CHART_CONTEXT);
  const response = await fetch('https://api.deepseek.com/chat/completions', {
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
          content: 'You write ethical, entertainment-focused Western astrology readings in polished American English. Do not claim certainty, diagnose, promise outcomes, or give medical, legal, or financial advice. Use only natal-chart data supplied by the user. Return valid JSON only, with no Markdown and no code fences.'
        },
        {
          role: 'user',
          content: `Create a concise, warm personalized reading for ${reading.name}. Return exactly this JSON shape:\n{\n  "archetype":"short poetic archetype, max 6 words",\n  "title":"a personal report title, max 8 words",\n  "opening":"a resonant 2-sentence insight, max 55 words",\n  "big_three":[\n    {"label":"Sun","sign":"sign name","meaning":"one practical sentence"},\n    {"label":"Moon","sign":"sign name","meaning":"one practical sentence"},\n    {"label":"Rising","sign":"sign name","meaning":"one practical sentence"}\n  ],\n  "attention":{"title":"short current-pattern title","body":"2 concise sentences, max 65 words"},\n  "ritual":{"intention":"short daily intention","practice":"one simple reflective practice, max 35 words"},\n  "bracelet":{"title":"A symbolic bracelet intention","crystals":["crystal 1","crystal 2","crystal 3"],"reason":"2 concise sentences explaining symbolic resonance, never a promise","cta_label":"EXPLORE YOUR ALIGNED BRACELETS"},\n  "disclaimer":"For reflection and personal inspiration. Your path is always your own."\n}\n\nBirth data: ${JSON.stringify(reading)}\n\nNatal-chart provider response: ${chartContext}`
        }
      ]
    })
  });

  if (!response.ok) throw new Error('The interpretation service is unavailable.');
  const data = await response.json();
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
    const cors = corsHeaders(request, env);
    if (!cors) return json({ error: 'Origin not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/reading') {
      return json({ error: 'Not found.' }, 404, cors);
    }

    try {
      const payload = await request.json();
      const reading = validReading(payload);
      if (!reading) return json({ error: 'Please provide valid birth details and email.' }, 400, cors);

      const location = await getBirthLocation(reading.birth_place, env);
      const natalChart = await requestNatalChart(reading, location, env);
      const profile = await createReading(reading, natalChart, env);
      return json({
        message: 'Your astral profile is ready.',
        profile,
        location: `${location.city}${location.country ? `, ${location.country}` : ''}`
      }, 200, cors);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Unknown reading error');
      return json({ error: 'The stars are briefly obscured. Please try again in a moment.' }, 502, cors);
    }
  }
};
