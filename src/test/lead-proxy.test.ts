import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAD_RATE_RULE,
  clientIp,
  handleSubmitLead,
  type CrmConfig,
} from "@/lib/lead-proxy.server";
import { resetRateLimit } from "@/lib/rate-limit";
import type { CaptchaResult } from "@/lib/turnstile.server";

const lead = {
  firstName: "José",
  lastName: "Silva",
  email: "jose@gmail.com",
  phone: "(21) 99876-5432",
  over30: true,
  experience: "beginner",
  goal: "extra_income",
  deposit: "yes",
  consent: true,
  utm: { utm_source: "meta", utm_campaign: "ouro-30" },
  clickId: "abc_123",
  fillMs: 45_000,
};

const config: CrmConfig = {
  endpoint: "https://crm.example/functions/v1/submit-lead",
  apiKey: "secret-key",
};
const mailOk = async () => true;
const captchaOk = async (_token?: string, _ip?: string): Promise<CaptchaResult> => ({ ok: true });

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://brasil.example/api/submit-lead", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function crmReplies(status: number, body: unknown) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );
}

const send = (
  req: Request,
  fetchImpl = crmReplies(201, { success: true, data: {} }),
  cfg = config,
  captcha: (token: string | undefined, ip: string) => Promise<CaptchaResult> = captchaOk,
) => handleSubmitLead(req, cfg, fetchImpl as unknown as typeof fetch, mailOk, captcha);

beforeEach(() => resetRateLimit());

describe("clientIp", () => {
  it("prefers Cloudflare's CF-Connecting-IP, then nginx's headers", () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(clientIp(h({ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(h({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe(
      "2.2.2.2",
    );
    expect(clientIp(h({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe("3.3.3.3");
    expect(clientIp(h({}))).toBe("");
  });
});

describe("handleSubmitLead", () => {
  it("forwards the lead to the CRM with key, IP and Brazil fields", async () => {
    const crm = crmReplies(201, { success: true, data: { lead_id: "L1" } });
    const res = await send(post(lead), crm);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const [url, init] = crm.mock.calls[0]!;
    expect(url).toBe(config.endpoint);
    const headers = init!.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("secret-key");
    expect(headers["Authorization"]).toBe("Bearer secret-key");
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({
      firstname: "José",
      lastname: "Silva",
      email: "jose@gmail.com",
      mobile: "+5521998765432",
      country_code: "BR",
      ip_address: "203.0.113.7",
      offer_name: "brasil-bullion",
      funnel: "commodities-br",
      click_id: "abc_123",
      custom1: "meta",
      custom2: "ouro-30",
      custom3: "high",
    });
    expect(body.questions).toEqual([
      { key: "age_30_plus", value: "yes" },
      { key: "experience", value: "Iniciante (já testei)" },
      { key: "goal", value: expect.any(String) },
      { key: "deposit_250", value: expect.any(String) },
      { key: "consent_contact_lgpd", value: "yes" },
      { key: "is_bot", value: "false" },
      { key: "suspected_bot", value: "none" },
    ]);
  });

  it("returns the autologin URL only for the CRM host over https", async () => {
    const ok = await send(
      post(lead),
      crmReplies(201, {
        success: true,
        data: { autologin_url: "https://crm.example/functions/v1/track-autologin?lead_id=1" },
      }),
    );
    expect((await ok.json()).autologin_url).toBe(
      "https://crm.example/functions/v1/track-autologin?lead_id=1",
    );
    resetRateLimit();
    const evil = await send(
      post(lead),
      crmReplies(201, { success: true, data: { autologin_url: "https://evil.example/x" } }),
    );
    expect((await evil.json()).autologin_url).toBeUndefined();
  });

  it("rejects wrong method, content type, size and bad JSON before calling the CRM", async () => {
    const crm = crmReplies(201, { success: true });
    expect((await send(new Request("https://b.example/api/submit-lead"), crm)).status).toBe(405);
    expect((await send(post(lead, { "content-type": "text/plain" }), crm)).status).toBe(415);
    expect((await send(post("x".repeat(9000)), crm)).status).toBe(413);
    expect((await send(post("{not json"), crm)).status).toBe(400);
    expect(crm).not.toHaveBeenCalled();
  });

  it("needs a client IP", async () => {
    const req = new Request("https://b.example/api/submit-lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lead),
    });
    expect((await send(req)).status).toBe(400);
  });

  it("returns the field and message for invalid input", async () => {
    const res = await send(post({ ...lead, phone: "(10) 99876-5432" }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ field: "phone", error: "DDD inválido" });
  });

  const botFlags = async (body: unknown, headers: Record<string, string> = {}) => {
    const crm = crmReplies(201, { success: true, data: {} });
    expect((await send(post(body, headers), crm)).status).toBe(200);
    const questions = JSON.parse(crm.mock.calls[0]![1]!.body as string).questions as {
      key: string;
      value: string;
    }[];
    return Object.fromEntries(
      questions.filter((q) => q.key.endsWith("bot")).map((q) => [q.key, q.value]),
    );
  };

  it("sends suspicious leads to the CRM flagged is_bot with the reasons", async () => {
    expect(await botFlags({ ...lead, website: "spam.example" })).toEqual({
      is_bot: "true",
      suspected_bot: "honeypot",
    });
    expect(await botFlags({ ...lead, fillMs: 1200 }, { "cf-ipcountry": "US" })).toEqual({
      is_bot: "true",
      suspected_bot: "fast_submit,non_br_country",
    });
    const { fillMs: _omit, ...noTiming } = lead;
    expect(await botFlags(noTiming)).toEqual({ is_bot: "true", suspected_bot: "no_fill_time" });
  });

  it("does not flag Brazilian or unknown-country visitors", async () => {
    for (const cc of ["BR", "br", "XX"])
      expect(await botFlags(lead, { "cf-ipcountry": cc })).toEqual({
        is_bot: "false",
        suspected_bot: "none",
      });
  });

  it("rate-limits per IP", async () => {
    for (let i = 0; i < LEAD_RATE_RULE.limit; i++)
      expect((await send(post(lead))).status).toBe(200);
    expect((await send(post(lead))).status).toBe(429);
    expect((await send(post(lead, { "cf-connecting-ip": "198.51.100.1" }))).status).toBe(200);
  });

  it("rejects e-mail domains that cannot receive mail", async () => {
    const crm = crmReplies(201, { success: true });
    const res = await handleSubmitLead(
      post(lead),
      config,
      crm as unknown as typeof fetch,
      async () => false,
      captchaOk,
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe("email");
    expect(crm).not.toHaveBeenCalled();
  });

  it("maps CRM duplicates and field errors", async () => {
    const dup = await send(post(lead), crmReplies(409, { success: false }));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toContain("já possui cadastro");

    const bad = await send(
      post(lead),
      crmReplies(422, { success: false, errors: { mobile: "too short" } }),
    );
    expect(await bad.json()).toMatchObject({ field: "phone" });
  });

  it("answers 503 when not configured or the CRM is down (never 502/504)", async () => {
    expect((await send(post(lead), undefined, { endpoint: config.endpoint })).status).toBe(503);
    const down = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    expect((await send(post(lead), down as never)).status).toBe(503);
    expect((await send(post(lead), crmReplies(500, { success: false }))).status).toBe(503);
  });

  it("checks the captcha with the token and visitor IP before calling the CRM", async () => {
    const crm = crmReplies(201, { success: true });
    const captcha = vi.fn(captchaOk);
    const res = await send(post({ ...lead, captchaToken: "tok" }), crm, config, captcha);
    expect(res.status).toBe(200);
    expect(captcha).toHaveBeenCalledWith("tok", "203.0.113.7");
    expect(JSON.parse(crm.mock.calls[0]![1]!.body as string)).not.toHaveProperty("captchaToken");
  });

  it("rejects a failed captcha with 403 and never calls the CRM", async () => {
    const crm = crmReplies(201, { success: true });
    for (const reason of ["missing", "invalid", "hostname", "action"] as const) {
      const res = await send(post(lead), crm, config, async () => ({ ok: false, reason }));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toContain("verificação de segurança");
    }
    expect(crm).not.toHaveBeenCalled();
  });

  it("answers 503 when the captcha can't be checked (fail closed)", async () => {
    const crm = crmReplies(201, { success: true });
    for (const reason of ["unavailable", "not_configured"] as const) {
      const res = await send(post(lead), crm, config, async () => ({ ok: false, reason }));
      expect(res.status).toBe(503);
    }
    expect(crm).not.toHaveBeenCalled();
  });

  it("still requires the captcha for honeypot leads", async () => {
    const crm = crmReplies(201, { success: true });
    const res = await send(post({ ...lead, website: "spam.example" }), crm, config, async () => ({
      ok: false,
      reason: "missing",
    }));
    expect(res.status).toBe(403);
    expect(crm).not.toHaveBeenCalled();
  });
});
