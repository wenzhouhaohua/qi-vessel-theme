# QI Reading Worker

Secure server-side bridge for the Shopify astrology form:

`Shopify form -> Worker /reading -> RoxyAPI natal chart -> DeepSeek report -> Shopify`

## Before deployment

1. Create or sign in to a Cloudflare account.
2. Install Node.js LTS and run `npm install` in this folder.
3. Run `npx wrangler login`.
4. The Worker uses RoxyAPI's documented `GET /api/v2/location/search` and `POST /api/v2/astrology/natal-chart` endpoints. It converts the entered city into coordinates and calculates the historical UTC offset from RoxyAPI's IANA timezone before requesting the natal chart.

## Secrets and configuration

Never put a provider key in Shopify or Git. From this folder run:

```powershell
npx wrangler secret put ROXY_API_KEY
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put ALLOWED_ORIGIN
npx wrangler secret put SHOPIFY_API_SECRET
```

Use `https://qivessel.com` as `ALLOWED_ORIGIN`. Add the `www` address as a comma-separated value only if that is also live.
Set `SHOPIFY_API_SECRET` to the shared secret of the Shopify app that owns the App Proxy, so the Worker can verify the `signature` query parameter on `/apps/reading` requests. You can optionally set `SHOPIFY_SHOP_DOMAIN` (for example `your-shop.myshopify.com`) to reject proxy requests signed for any other shop.

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

This worker does not persist emails or reading data.

The theme posts to `/apps/reading` (Shopify App Proxy) or directly to `/reading` on the Worker; both paths are accepted. App Proxy requests carry `signature`/`shop`/`timestamp` query parameters, which the Worker verifies with an HMAC-SHA256 digest before processing. Direct Worker calls are allowed only from origins listed in `ALLOWED_ORIGIN`.

The theme renders the returned `profile` object (archetype, big three, tension, ritual, bracelet, disclaimer) inside the reading dialog.

## City picker endpoint

The theme's birthplace picker searches `GET /locations?q=<query>&limit=<1-8>` (same Worker, also accepted as `/apps/locations`). It proxies RoxyAPI's city search and returns a slim list:

```json
{
  "cities": [
    {
      "label": "New York, NY, United States",
      "city": "New York",
      "province": "NY",
      "country": "United States",
      "iso2": "US",
      "latitude": 40.7128,
      "longitude": -74.006,
      "timezone": "America/New_York"
    }
  ]
}
```

`label` is built from the canonical `city`/`province`/`country` fields, so selecting it and submitting avoids fuzzy re-matching. Requests to `/locations` use the same authorization as `/reading` (Shopify App Proxy signature or an allowed `Origin`). The theme's **QI Sacred Hero -> City search API endpoint** setting points at this URL.

For mobile visitors (whose networks often cannot reach `workers.dev` reliably), the theme defaults the picker to the same-origin proxy route `GET /apps/reading?mode=locations&q=<query>` instead. Shopify's App Proxy forwards it to the Worker with the usual `signature`/`shop`/`timestamp` parameters, and the Worker serves the same city-search response when `mode=locations` is present on a reading path. No extra App Proxy subpath is required. A fallback to the direct `/locations` Worker URL is used only if the same-origin call fails.

## Optional exact-coordinate submission

When a visitor picks a city from the picker, the theme sends three extra fields in the reading POST body:

```json
{
  "name": "...",
  "birth_date": "1990-05-15",
  "birth_time": "14:30",
  "birth_place": "New York, NY, United States",
  "email": "...",
  "birth_latitude": 40.7128,
  "birth_longitude": -74.006,
  "birth_timezone": "America/New_York"
}
```

If all three are present and valid (latitude within -90..90, longitude within -180..180, and a real IANA timezone), the Worker skips the RoxyAPI birthplace lookup and uses these coordinates directly for the natal chart. If any field is missing or invalid, the Worker falls back to the regular free-text lookup.
