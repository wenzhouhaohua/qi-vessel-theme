# QI Reading Worker

Secure server-side bridge for the Shopify astrology form:

`Shopify form -> Worker /reading -> RoxyAPI natal chart -> DeepSeek report -> Shopify`

## Before deployment

1. Create or sign in to a Cloudflare account.
2. Install Node.js LTS and run `npm install` in this folder.
3. Run `npx wrangler login`.
4. Confirm the exact RoxyAPI natal-chart endpoint, authentication header, and request/response schema. Update `requestNatalChart` in `src/index.js` if its documented schema differs.

## Secrets and configuration

Never put a provider key in Shopify or Git. From this folder run:

```powershell
npx wrangler secret put ROXY_API_KEY
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put ROXY_API_URL
npx wrangler secret put ALLOWED_ORIGIN
```

Use `https://qivessel.com` as `ALLOWED_ORIGIN`. Add the `www` address as a comma-separated value only if that is also live.

## Deploy

```powershell
npm install
npx wrangler login
npm run deploy
```

Cloudflare will print a Worker URL similar to:

`https://qi-reading-worker.<your-subdomain>.workers.dev/reading`

Paste that complete URL into the Shopify theme editor under **QI Sacred Hero -> Secure reading API endpoint**.

## Important

This worker is deployable after RoxyAPI's documented request format is confirmed. It does not persist emails or reading data. The Shopify theme must still be updated to display the returned `report`; the current form only displays the short `message` field.
