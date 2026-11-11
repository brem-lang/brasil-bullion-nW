import {
  depositOptions,
  experienceOptions,
  goalOptions,
  leadSchema,
  scoreLead,
  type Lead,
  type LeadField,
} from "./lead";
import { isRateLimited, type RateRule } from "./rate-limit";
import { CAPTCHA_ERROR } from "./turnstile";
import { verifyTurnstile, type CaptchaResult } from "./turnstile.server";
import { checkBrMobile } from "./validation";

// Lead endpoint, modelled on arabic-trading-spark's src/lib/lead-proxy.server.ts.
// The browser posts here; the server adds the visitor IP and the CRM API key.

export const LEAD_PATH = "/api/submit-lead";

/** Lead submits allowed per visitor IP (the CRM also rejects a second lead from one IP). */
export const LEAD_RATE_RULE: RateRule = { limit: 5, windowMs: 10 * 60_000 };

const MAX_BODY_BYTES = 8_192;
const CRM_TIMEOUT_MS = 15_000;
const OFFER_NAME = "brasil-bullion";
const CLICK_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;
/** Filling 3 contact fields and 3 questions takes a person well over this. */
export const MIN_FILL_MS = 3_000;

/** Signs a lead may be a bot. These leads still go to the CRM, flagged with is_bot. */
export type BotReason = "honeypot" | "fast_submit" | "no_fill_time" | "non_br_country";

/**
 * Likely-bot signals. Certain ones (no valid captcha) are rejected before this runs.
 * fillMs comes from the browser, so a bot can fake it; it still catches careless ones.
 * country is Cloudflare's CF-IPCountry ("XX" = unknown, "T1" = Tor).
 */
export function botReasons(lead: Lead, country?: string | null): BotReason[] {
  const reasons: BotReason[] = [];
  if (lead.website) reasons.push("honeypot");
  if (lead.fillMs === undefined) reasons.push("no_fill_time");
  else if (lead.fillMs < MIN_FILL_MS) reasons.push("fast_submit");
  const cc = country?.trim().toUpperCase();
  if (cc && cc !== "BR" && cc !== "XX") reasons.push("non_br_country");
  return reasons;
}

const FORM_FIELDS: readonly string[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
] satisfies LeadField[];

export type CrmConfig = {
  endpoint?: string | undefined;
  apiKey?: string | undefined;
  funnel?: string | undefined;
  /** Extra hosts (besides the CRM's own) the visitor may be redirected to after signup. */
  autologinHosts?: string[] | undefined;
  /** Local dev only: IP to send when there is no Cloudflare/nginx header. */
  devIp?: string | undefined;
};

/** Server-only settings from .env (never VITE_*, so the API key is not bundled into the page). */
export function crmConfig(): CrmConfig {
  return {
    endpoint: process.env["BASE_ENDPOINT"],
    apiKey: process.env["BASE_API_KEY"],
    funnel: process.env["LEAD_FUNNEL"],
    autologinHosts: (process.env["LEAD_AUTOLOGIN_HOSTS"] ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
    devIp: import.meta.env.DEV ? process.env["DEV_IP_ADDRESS"] || "127.0.0.1" : undefined,
  };
}

/**
 * The visitor's IP: Cloudflare's CF-Connecting-IP first, then what nginx adds.
 * Trustworthy because nginx only accepts Cloudflare (cloudflare-only.conf) and the
 * app only listens on 127.0.0.1.
 */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  const real = headers.get("x-real-ip")?.trim();
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (cf || real || forwarded || "").slice(0, 45);
}

// Responses stay below 502/504 on purpose: Cloudflare replaces those with its own page.
function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

const label = (opts: readonly { value: string; label: string }[], v: string) =>
  opts.find((o) => o.value === v)?.label ?? v;

export function toCrmPayload(
  lead: Lead,
  ipAddress: string,
  config: CrmConfig,
  userAgent?: string,
  reasons: readonly BotReason[] = [],
) {
  const phone = checkBrMobile(lead.phone);
  const score = scoreLead(lead);
  const utm = lead.utm ?? {};
  const clickId = lead.clickId && CLICK_ID_RE.test(lead.clickId) ? lead.clickId : undefined;
  return {
    firstname: lead.firstName,
    lastname: lead.lastName,
    email: lead.email,
    mobile: phone.ok ? phone.e164 : lead.phone,
    country_code: "BR",
    country: "Brazil",
    ip_address: ipAddress,
    locale: "pt-BR",
    click_id: clickId,
    offer_name: OFFER_NAME,
    funnel: config.funnel || "commodities-br",
    custom1: utm["utm_source"],
    custom2: utm["utm_campaign"],
    custom3: score,
    click_ua: userAgent?.slice(0, 500),
    // The five form questions, then the bot flag; score and UTMs already go in custom1–3.
    // The schema requires over30 and consent to be true, so both are always "yes".
    questions: [
      { key: "age_30_plus", value: "yes" },
      { key: "experience", value: label(experienceOptions, lead.experience) },
      { key: "goal", value: label(goalOptions, lead.goal) },
      { key: "deposit_250", value: label(depositOptions, lead.deposit) },
      { key: "consent_contact_lgpd", value: "yes" },
      { key: "is_bot", value: reasons.length > 0 ? "true" : "false" },
      { key: "suspected_bot", value: reasons.join(",") || "none" },
    ],
  };
}

// Can the e-mail's domain receive mail (MX, or A as fallback)? Only a definite
// "no such domain" rejects; timeouts and DNS errors let the lead through.
const mailDomainCache = new Map<string, boolean>();
export async function domainReceivesMail(email: string): Promise<boolean> {
  const domain = email.slice(email.lastIndexOf("@") + 1);
  const cached = mailDomainCache.get(domain);
  if (cached !== undefined) return cached;
  const dns = await import("node:dns/promises");
  const lookup = async (type: "MX" | "A") => {
    try {
      const records = await (type === "MX" ? dns.resolveMx(domain) : dns.resolve4(domain));
      return records.length > 0;
    } catch (err) {
      const code = (err as { code?: string }).code;
      return code === "ENOTFOUND" || code === "ENODATA" ? false : null;
    }
  };
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
  const mx = await Promise.race([lookup("MX"), timeout]);
  const result = mx !== false || (await Promise.race([lookup("A"), timeout])) !== false;
  if (mailDomainCache.size > 5000) mailDomainCache.clear();
  mailDomainCache.set(domain, result);
  return result;
}

// CRM field name → form field + message shown to the visitor.
const CRM_FIELD: Record<string, { field: LeadField; error: string }> = {
  firstname: { field: "firstName", error: "Verifique seu nome" },
  lastname: { field: "lastName", error: "Verifique seu sobrenome" },
  email: { field: "email", error: "Verifique seu e-mail" },
  mobile: { field: "phone", error: "Verifique seu número de WhatsApp" },
};

type CrmResponse = {
  success?: boolean;
  message?: unknown;
  errors?: unknown;
  rejection?: { code?: unknown };
  autologin_url?: unknown;
  data?: { lead_id?: unknown; autologin_url?: unknown };
};

/** Only redirect over HTTPS to the CRM's host or an allow-listed one (no open redirect). */
function allowedAutologin(value: unknown, config: CrmConfig): string | undefined {
  if (typeof value !== "string" || !config.endpoint) return undefined;
  try {
    const url = new URL(value);
    const hosts = new Set([
      new URL(config.endpoint).host.toLowerCase(),
      ...(config.autologinHosts ?? []),
    ]);
    if (url.protocol === "https:" && hosts.has(url.host.toLowerCase())) return url.href;
    console.error(
      `lead submit: autologin host "${url.host}" not allowed; add it to LEAD_AUTOLOGIN_HOSTS`,
    );
  } catch {
    // not a URL
  }
  return undefined;
}

/** POST /api/submit-lead */
export async function handleSubmitLead(
  request: Request,
  config: CrmConfig = crmConfig(),
  fetchImpl: typeof fetch = fetch,
  checkMailDomain: (email: string) => Promise<boolean> = domainReceivesMail,
  verifyCaptcha: (token: string | undefined, ip: string) => Promise<CaptchaResult> = (t, i) =>
    verifyTurnstile(t, i),
): Promise<Response> {
  if (request.method !== "POST") return json(405, { success: false });
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json(415, { success: false });
  }

  const ip = clientIp(request.headers) || config.devIp || "";
  if (!ip) {
    console.error("lead submit: no client IP header (is the request coming through nginx?)");
    return json(400, { success: false });
  }
  if (isRateLimited(`lead:${ip}`, LEAD_RATE_RULE)) {
    return json(429, {
      success: false,
      error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json(413, { success: false });
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return json(400, { success: false });
  }

  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return json(422, {
      success: false,
      errors: parsed.error.issues.map((i) => i.path.join(".")),
      ...(typeof field === "string" && FORM_FIELDS.includes(field)
        ? { field, error: issue?.message }
        : {}),
    });
  }
  const lead = parsed.data;

  if (!config.endpoint || !config.apiKey) {
    console.error("lead submit: BASE_ENDPOINT or BASE_API_KEY is not set");
    return json(503, { success: false });
  }

  // Before the CRM call: no lead without a valid captcha (fail closed if Cloudflare is down).
  const captcha = await verifyCaptcha(lead.captchaToken, ip);
  if (!captcha.ok) {
    if (captcha.reason === "not_configured") {
      console.error("lead submit: TURNSTILE_SECRET_KEY is not set");
      return json(503, { success: false });
    }
    if (captcha.reason === "unavailable") {
      console.error(`lead submit: rejected reason=captcha_unavailable detail=${captcha.detail}`);
      return json(503, {
        success: false,
        error: "Não foi possível verificar agora. Tente novamente em instantes.",
      });
    }
    console.warn(
      `lead submit: rejected reason=captcha_failed detail=${captcha.reason}:${captcha.detail || "-"}`,
    );
    return json(403, { success: false, error: CAPTCHA_ERROR });
  }

  if (!(await checkMailDomain(lead.email))) {
    return json(422, {
      success: false,
      field: "email",
      error: "Este domínio de e-mail não existe. Verifique o endereço.",
    });
  }

  // Suspicious but not certain: send to the CRM flagged, so no real lead is lost.
  const reasons = botReasons(lead, request.headers.get("cf-ipcountry"));
  const payload = toCrmPayload(
    lead,
    ip,
    config,
    request.headers.get("user-agent") ?? undefined,
    reasons,
  );
  // One log line per lead: no key, no personal data.
  const sent = `score=${payload.custom3} click_id=${payload.click_id ?? "-"} is_bot=${reasons.length > 0} suspected_bot=${reasons.join(",") || "none"}`;
  try {
    const res = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
    });
    const body = await res.text();
    let result: CrmResponse = {};
    try {
      result = JSON.parse(body) as CrmResponse;
    } catch {
      // not JSON; handled below
    }

    if (res.status === 409) {
      console.warn(`lead submit: ${sent} → duplicate (409)`);
      return json(409, {
        success: false,
        error: "Você já possui cadastro conosco. Em breve um especialista entrará em contato.",
      });
    }
    if (!res.ok || result.success !== true) {
      const errorFields =
        result.errors && typeof result.errors === "object" ? Object.keys(result.errors) : [];
      console.warn(
        `lead submit: ${sent} → CRM rejected status=${res.status} code=${String(result.rejection?.code ?? "-")} fields=${errorFields.join(",") || "-"}`,
      );
      if (result.rejection?.code === "DISPOSABLE_EMAIL") {
        return json(422, {
          success: false,
          field: "email",
          error: "Use um e-mail pessoal (e-mails temporários não são aceitos)",
        });
      }
      const known = errorFields.map((f) => CRM_FIELD[f]).find(Boolean);
      if (res.status === 422 && known) return json(422, { success: false, ...known });
      return json(res.status >= 500 ? 503 : 422, { success: false });
    }

    console.log(`lead submit: ${sent} → accepted lead_id=${String(result.data?.lead_id ?? "-")}`);
    return json(200, {
      success: true,
      autologin_url: allowedAutologin(result.data?.autologin_url ?? result.autologin_url, config),
    });
  } catch (err) {
    console.error(`lead submit: ${sent} → CRM request failed`, (err as Error).name);
    return json(503, { success: false });
  }
}
