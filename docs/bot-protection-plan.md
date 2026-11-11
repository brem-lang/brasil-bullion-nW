# Bot protection plan: captcha + honeypot

Status (2026-11-11): **Step 1 (captcha) built in brasil-bullion, not yet deployed.** Steps 2–4 and
arabic-trading-spark not started.
Applies to: `brasil-bullion` (first, it is the one receiving bot leads) and `arabic-trading-spark` (after).

## Why bots get through today

Both forms already have a hidden `website` honeypot and a per-IP rate limit, but:

- **Bots that POST straight to `/api/submit-lead`** never see the form, so they never fill the honeypot.
- **The rate limit is weak against bots:** brasil allows 5 submits / 10 min per IP, bots rotate IPs, and the
  counter lives in process memory (a restart resets it).
- **The two sites handle the honeypot differently:** brasil drops the lead silently
  (`src/lib/lead-proxy.server.ts`), arabic forwards it to the CRM with the `website` value.

A honeypot only catches simple bots. A captcha verified on the server stops the direct-POST bots.

## Policy: what happens to a bot lead

Reject what is certainly a bot, flag what is only suspicious, and log every rejection so we know.

| Signal | Certainty | Action |
| --- | --- | --- |
| Captcha missing / invalid | Certain | **Reject**, log `reason=captcha_failed` |
| Honeypot filled | Certain | **Drop silently** (answer success so the bot doesn't retry), log `reason=honeypot` |
| Submitted in < ~3 s | Likely | **Flag** to the CRM (`suspected_bot: "fast_submit"`) if it supports a field to filter on; otherwise reject, log `reason=too_fast` |

- No Meta `Lead` event for dropped or rejected leads (brasil already skips it for honeypot hits).
- Log lines carry the reason only, no personal data.
- Daily count on the VPS:

  ```sh
  journalctl -u brasil-bullion --since today | grep -o "reason=[a-z_]*" | sort | uniq -c
  ```

## Step 0: Find out what kind of bots they are (on the VPS)

```sh
journalctl -u brasil-bullion --since "7 days ago" | grep -c "honeypot filled"
journalctl -u brasil-bullion --since "7 days ago" | grep -c "accepted"
```

Near-zero honeypot hits alongside junk leads means the bots post directly or skip the field.

## Step 1: Captcha (Cloudflare Turnstile)

Chosen because both sites already sit behind Cloudflare, it is free, and most visitors see nothing or one checkbox.

**Cloudflare dashboard**

- Create one Turnstile widget (Managed mode) for both hostnames.
- Site key: public, goes in the page.
- Secret key: `TURNSTILE_SECRET_KEY` in `/var/www/<app>/.env` on the server only, never committed.
- Local `.env`: Cloudflare's always-pass test keys, so `npm run dev` works.

**Client** (`src/components/landing/LeadForm.tsx`; arabic: `LeadQuiz.tsx`)

- Load `https://challenges.cloudflare.com/turnstile/v0/api.js` on the form step and render the widget above submit.
- Send the token as `captchaToken`.
- Keep submit disabled until there is a token. Reset the widget after a failed submit: tokens are single-use and
  expire after 5 minutes.
- Widget language follows the page (`pt-BR`; arabic: per route).

**Server** (`src/lib/lead-proxy.server.ts` in both)

- Add `captchaToken` to the schema (`src/lib/lead.ts`; arabic: `src/lib/lead-schema.ts`).
- After the rate-limit and schema checks, and before the CRM call, send the token to Cloudflare's
  `siteverify` with the secret and the visitor IP.
- Require `success === true` and a `hostname` that is one of our domains.
- On failure: 403 with a translated message ("Verificação falhou, tente novamente.") and a log line.
- If Cloudflare doesn't answer within 5 s: reject (fail closed) and log it.

## Step 2: Stronger honeypot

- **Fill-time check:** record when the form first appeared and send it with the lead; apply the policy above to
  submits under about 3 s.
- **Less obvious field:** rename it to something natural (e.g. `company`) and hide it in an off-screen wrapper
  rather than on the input itself.
- **Arabic:** drop honeypot leads on the server like brasil, unless the CRM relies on the `website` value
  (see open questions).

## Step 3: Cloudflare settings (no code)

- WAF rate-limiting rule on `/api/submit-lead`, e.g. 3 requests / minute / IP. It runs at the edge and survives app restarts.
- Bot Fight Mode on for both zones.

## Step 4: Tests and rollout

- Extend `src/test/lead-proxy.test.ts` with a faked `siteverify`. Cover: valid token, invalid token, missing
  token, Cloudflare timeout, filled honeypot, too-fast submit.
- Ship brasil-bullion first, watch the `accepted` and `reason=` counts for 1–2 days, then repeat for
  arabic-trading-spark.
- On each server: add `TURNSTILE_SECRET_KEY` to `.env`, then `systemctl restart <service>`.

## Open questions

1. **Arabic honeypot:** does the CRM use the forwarded `website` value to flag bots, or can we drop those leads on our side?
2. **CRM flag:** does the CRM have a field we can use for `suspected_bot`, and can it filter on it?
3. **Cloudflare timeout:** fail closed (recommended) or fail open?
4. **Access:** who can create the Turnstile widget in the Cloudflare account and share the site key?
