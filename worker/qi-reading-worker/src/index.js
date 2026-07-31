const DEFAULT_ORIGIN = 'https://qivessel.com';
const MAX_CHART_CONTEXT = 18000;

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

// RoxyAPI's endpoint and request schema must be confirmed against your account's documentation.
// The Worker intentionally keeps this adapter in one place so provider changes never touch Shopify code.
const requestNatalChart = async (reading, env) => {
  if (!env.ROXY_API_URL || !env.ROXY_API_KEY) {
    throw new Error('RoxyAPI is not configured.');
  }

  const response = await fetch(env.ROXY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.ROXY_API_KEY}`
    },
    body: JSON.stringify({
      birth_date: reading.birth_date,
      birth_time: reading.birth_time,
      birth_place: reading.birth_place
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
      temperature: 0.72,
      max_tokens: 1400,
      messages: [
        {
          role: 'system',
          content: 'You write ethical, entertainment-focused Western astrology readings in polished American English. Do not claim certainty, diagnose, promise outcomes, or give medical, legal, or financial advice. Use the natal-chart data supplied by the user. End with a gentle crystal bracelet recommendation framed as a symbolic intention, not a guarantee.'
        },
        {
          role: 'user',
          content: `Create a concise, warm astrology reading for ${reading.name}. Use these headings: Your Celestial Signature, What Wants Your Attention, Your Ritual Intention, Crystal Bracelet Guidance. Keep it under 850 words.\n\nBirth data: ${JSON.stringify(reading)}\n\nNatal-chart provider response: ${chartContext}`
        }
      ]
    })
  });

  if (!response.ok) throw new Error('The interpretation service is unavailable.');
  const data = await response.json();
  const report = data?.choices?.[0]?.message?.content?.trim();
  if (!report) throw new Error('The interpretation service returned no reading.');
  return report;
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

      const natalChart = await requestNatalChart(reading, env);
      const report = await createReading(reading, natalChart, env);
      return json({ message: 'Your astral profile is ready.', report }, 200, cors);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Unknown reading error');
      return json({ error: 'The stars are briefly obscured. Please try again in a moment.' }, 502, cors);
    }
  }
};
