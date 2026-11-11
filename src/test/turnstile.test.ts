import { describe, expect, it, vi } from "vitest";
import { TEST_SECRET, verifyTurnstile, type TurnstileConfig } from "@/lib/turnstile.server";

const config: TurnstileConfig = { secret: "real-secret", hostnames: ["brasil.example"] };

function cloudflareReplies(body: unknown) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status: 200 }),
  );
}
const ok = { success: true, hostname: "brasil.example", action: "lead" };
const check = (body: unknown, cfg = config) =>
  verifyTurnstile("tok", "203.0.113.7", cfg, cloudflareReplies(body) as unknown as typeof fetch);

describe("verifyTurnstile", () => {
  it("sends secret, token and IP to Cloudflare's siteverify", async () => {
    const cf = cloudflareReplies(ok);
    expect(
      await verifyTurnstile("tok", "203.0.113.7", config, cf as unknown as typeof fetch),
    ).toEqual({ ok: true });
    const [url, init] = cf.mock.calls[0]!;
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(JSON.parse(init!.body as string)).toEqual({
      secret: "real-secret",
      response: "tok",
      remoteip: "203.0.113.7",
    });
  });

  it("rejects invalid tokens, other hostnames and other actions", async () => {
    expect(await check({ success: false, "error-codes": ["invalid-input-response"] })).toEqual({
      ok: false,
      reason: "invalid",
      detail: "invalid-input-response",
    });
    expect(await check({ ...ok, hostname: "evil.example" })).toMatchObject({ reason: "hostname" });
    expect(await check({ ...ok, action: "other" })).toMatchObject({ reason: "action" });
  });

  it("accepts any hostname when none are configured", async () => {
    expect(
      await check({ ...ok, hostname: "x.example" }, { secret: "real-secret", hostnames: [] }),
    ).toEqual({
      ok: true,
    });
  });

  it("skips the action check for Cloudflare's test secret", async () => {
    expect(
      await check({ success: true, hostname: "example.com" }, { secret: TEST_SECRET }),
    ).toEqual({
      ok: true,
    });
  });

  it("reports a missing token or secret without calling Cloudflare", async () => {
    const cf = cloudflareReplies(ok);
    const f = cf as unknown as typeof fetch;
    expect(await verifyTurnstile(undefined, "1.1.1.1", config, f)).toMatchObject({
      reason: "missing",
    });
    expect(await verifyTurnstile("tok", "1.1.1.1", {}, f)).toMatchObject({
      reason: "not_configured",
    });
    expect(cf).not.toHaveBeenCalled();
  });

  it("reports Cloudflare being unreachable", async () => {
    const down = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await verifyTurnstile("tok", "1.1.1.1", config, down as never)).toMatchObject({
      reason: "unavailable",
    });
  });
});
