import { leadSchema, type LeadField } from "./lead";

/** Same-origin endpoint (src/lib/lead-proxy.server.ts); it adds the visitor IP and the API key. */
const LEAD_ENDPOINT = "/api/submit-lead";

const GENERIC_ERROR = "Não foi possível enviar agora. Tente novamente em instantes.";
const FIELDS: readonly string[] = ["firstName", "lastName", "email", "phone"];

type SubmitResponse = {
  success?: boolean;
  autologin_url?: unknown;
  field?: unknown;
  error?: unknown;
};

export type SubmitResult =
  | { ok: true; autologinUrl?: string | undefined }
  | { ok: false; error: string; field?: LeadField | undefined };

/** Only follow absolute https URLs, so a bad response can't run `javascript:` etc. */
function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sends a lead to our own server, which forwards it to the CRM. The browser never
 * sees the CRM API key and never has to look up its own IP.
 */
export async function submitLead(input: unknown): Promise<SubmitResult> {
  // Same check the server runs; throws before any request.
  leadSchema.parse(input);
  try {
    const res = await fetch(LEAD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as SubmitResponse;
    if (res.ok && body.success === true)
      return { ok: true, autologinUrl: safeUrl(body.autologin_url) };
    console.error("lead submit failed", res.status);
    const field =
      typeof body.field === "string" && FIELDS.includes(body.field)
        ? (body.field as LeadField)
        : undefined;
    return { ok: false, field, error: typeof body.error === "string" ? body.error : GENERIC_ERROR };
  } catch (err) {
    console.error("lead submit failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}
