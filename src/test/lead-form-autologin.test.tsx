import { forwardRef, useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubmitResult } from "@/lib/submit-lead";

const submitLead = vi.fn<(input: unknown) => Promise<SubmitResult>>();
vi.mock("@/lib/submit-lead", () => ({ submitLead: (i: unknown) => submitLead(i) }));
vi.mock("@/lib/meta-pixel", () => ({ trackLead: vi.fn() }));
vi.mock("@/lib/turnstile", () => ({
  TURNSTILE_SITE_KEY: "test-key",
  TURNSTILE_ACTION: "lead",
  CAPTCHA_ERROR: "captcha",
}));
// The captcha passes at once, so tests can submit without Cloudflare.
vi.mock("@/components/landing/Turnstile", () => ({
  Turnstile: forwardRef<unknown, { onToken: (t: string) => void }>(function Turnstile(
    { onToken },
    _ref,
  ) {
    useEffect(() => onToken("tok"), [onToken]);
    return null;
  }),
}));

const { LeadForm } = await import("@/components/landing/LeadForm");

const URL_OK = "https://crm.example/autologin?t=abc";

let open: ReturnType<typeof vi.fn>;
let assign: ReturnType<typeof vi.fn>;
beforeEach(() => {
  open = vi.fn();
  assign = vi.fn();
  vi.stubGlobal("open", open);
  vi.stubGlobal("location", { ...window.location, search: "", assign });
  submitLead.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function fillAndSubmit() {
  render(<LeadForm />);
  fireEvent.change(screen.getByPlaceholderText("Nome"), { target: { value: "Maria" } });
  fireEvent.change(screen.getByPlaceholderText("Sobrenome"), { target: { value: "Silva" } });
  fireEvent.change(screen.getByPlaceholderText("Seu melhor e-mail"), {
    target: { value: "maria.silva@gmail.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("(11) 98765-4321"), {
    target: { value: "11987654321" },
  });
  fireEvent.click(screen.getByText(/30 anos ou mais/));
  fireEvent.click(screen.getByText("Continuar"));
  fireEvent.click(screen.getByText("Nunca operei"));
  fireEvent.click(screen.getByText("Renda extra mensal"));
  fireEvent.click(screen.getByText("Sim, começo com US$250+"));
  fireEvent.click(screen.getByText(/Aceito ser contatado/));
  fireEvent.click(screen.getByText("Quero começar agora"));
}

describe("LeadForm autologin", () => {
  it("redirects this tab to the autologin URL without opening a new one", async () => {
    submitLead.mockResolvedValue({ ok: true, autologinUrl: URL_OK });

    fillAndSubmit();
    await screen.findByText(/Cadastro recebido/);
    // The thank-you screen shows first, then the redirect.
    expect(assign).not.toHaveBeenCalled();
    await waitFor(() => expect(assign).toHaveBeenCalledWith(URL_OK), { timeout: 3000 });
    expect(open).not.toHaveBeenCalled();
  });

  it("stays on the thank-you screen when there is no autologin URL", async () => {
    submitLead.mockResolvedValue({ ok: true });

    fillAndSubmit();
    await screen.findByText(/Cadastro recebido/);
    await new Promise((r) => setTimeout(r, 1600));
    expect(assign).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
