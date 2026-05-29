# External cron scheduler — endpoint reference

Configure your third-party scheduler to call these URLs. Scheduling is **not** done via Vercel Cron unless you add it separately.

## Base URL

Replace `<YOUR_PRODUCTION_HOST>` with your production hostname (Vercel deployment URL or custom domain).

```
https://<YOUR_PRODUCTION_HOST>
```

## Authentication

When the deployment has `CRON_SECRET` set, every request must include:

```http
Authorization: Bearer <CRON_SECRET>
```

Use the same value as the `CRON_SECRET` environment variable in Vercel. If `CRON_SECRET` is unset, routes do not require auth (set the secret in production and in your scheduler).

`/api/cron` paths are excluded from session middleware (no login cookie required); access control is the `Authorization` header in each route.

## Request shape

- **Method:** `GET` for all endpoints below.
- **Query parameters:** optional `dryRun=true` for nightly redistribution (no DB writes).
- **Request body:** none.

## Endpoints

| # | Path | Suggested schedule (UTC) | Notes |
|---|------|--------------------------|--------|
| 1 | `/api/cron/nightly-redistribute-stage0` | `30 2 * * *` | Morning redistribution at ~8:00 AM IST. Redistributes **today's FU0** (`followup_number = 0`; `attempt_count` may be > 0) pending followups for **Fitty and Fitelo** in one run. Equalizes each agent's final total today pending load. |

## Full URL (copy-paste template)

Replace `<YOUR_PRODUCTION_HOST>` and send `Authorization: Bearer <CRON_SECRET>` on each request.

1. `GET` `https://<YOUR_PRODUCTION_HOST>/api/cron/nightly-redistribute-stage0`
2. Dry run: `GET` `https://<YOUR_PRODUCTION_HOST>/api/cron/nightly-redistribute-stage0?dryRun=true`

## Local dry-run script

```bash
npm run dry-run:nightly-redistribute-stage0
```

Requires `.env.local` with database credentials (same as other scripts).

## Operational checklist

- [ ] `CRON_SECRET` set in Vercel Production (and Preview if you test there).
- [ ] Scheduler stores the same secret and sends `Authorization: Bearer …`.
- [ ] Run `dryRun=true` once in staging before enabling the live schedule.
