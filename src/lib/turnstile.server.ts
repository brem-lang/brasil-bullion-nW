import { TURNSTILE_ACTION } from "./turnstile";

// Server-side check of a Turnstile token. Each token is single-use and valid for 5 minutes.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5_000;

/** Cloudflare's test secret: every token passes. Used by `npm run dev` when no secret is set. */
export const TEST_SECRET = "1x0000000000000000000000000000000AA";

export type TurnstileConfig = {
  secret?: string | undefined;
  /** Hostnames a token may come from; empty means any (Cloudflare's widget settings still apply). */
  hostnames?: string[] | undefined;
};

/** Server-only settings from .env: TURNSTILE_SECRET_KEY and optional TURNSTILE_HOSTNAMES (comma list). */
export function turnstileConfig(): TurnstileConfig {
  return {
    secret: process.env["TURNSTILE_SECRET_KEY"] || (import.meta.env.DEV ? TEST_SECRET : undefined),
    hostnames: (process.env["TURNSTILE_HOSTNAMES"] ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  };
}

export type CaptchaResult =
  | { ok: true }
  | {
      ok: false;
      /** missing/invalid/hostname/action: treat as a bot. unavailable/not_configured: our side. */
      reason: "missing" | "invalid" | "hostname" | "action" | "unavailable" | "not_configured";
      detail?: string;
    };

type SiteverifyResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
  config: TurnstileConfig = turnstileConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<CaptchaResult> {
  if (!config.secret) return { ok: false, reason: "not_configured" };
  if (!token) return { ok: false, reason: "missing" };

  let result: SiteverifyResponse;
  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: config.secret, response: token, remoteip: ip || undefined }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    result = (await res.json()) as SiteverifyResponse;
  } catch (err) {
    return { ok: false, reason: "unavailable", detail: (err as Error).name };
  }

  if (result.success !== true) {
    return { ok: false, reason: "invalid", detail: (result["error-codes"] ?? []).join(",") };
  }
  const hostname = (result.hostname ?? "").toLowerCase();
  if (config.hostnames?.length && !config.hostnames.includes(hostname)) {
    return { ok: false, reason: "hostname", detail: hostname || "-" };
  }
  // Test-key tokens carry no action, so only check it with a real secret.
  if (config.secret !== TEST_SECRET && result.action !== TURNSTILE_ACTION) {
    return { ok: false, reason: "action", detail: result.action || "-" };
  }
  return { ok: true };
}
