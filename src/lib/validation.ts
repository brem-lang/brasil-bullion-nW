// Field checks shared by the form (instant feedback) and the server (final say).
// Rules match or are stricter than the CRM's submit-lead, so a lead that passes
// here is not rejected there for format reasons.

// --- Names -------------------------------------------------------------------
// Letters (any accent), spaces, apostrophes, hyphens and dots. 2–50 chars (CRM max).
const NAME_RE = /^[\p{L}][\p{L}\p{M}' .-]*$/u;

export type NameResult = { ok: true; value: string } | { ok: false; error: string };

export function checkName(raw: string, label: "nome" | "sobrenome"): NameResult {
  const value = raw.trim().replace(/\s+/g, " ");
  const Label = label === "nome" ? "Nome" : "Sobrenome";
  if (!value) return { ok: false, error: `Informe seu ${label}` };
  if (value.length < 2) return { ok: false, error: `${Label} muito curto` };
  if (value.length > 50) return { ok: false, error: `${Label} muito longo (máx. 50 letras)` };
  if (!NAME_RE.test(value)) return { ok: false, error: `${Label} deve conter apenas letras` };
  if (/(.)\1{3,}/iu.test(value)) return { ok: false, error: `${Label} inválido` };
  return { ok: true, value };
}

// --- E-mail ------------------------------------------------------------------
// Same pattern the CRM uses.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "throwawaymail.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "emailondeck.com",
  "mohmal.com",
]);

// Common Brazilian-provider typos → the intended domain.
const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.com.br": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "hotmal.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outllok.com": "outlook.com",
  "yahoo.con": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.com.b": "yahoo.com.br",
  "yahoo.co.br": "yahoo.com.br",
  "bol.com": "bol.com.br",
  "uol.com": "uol.com.br",
  "terra.com": "terra.com.br",
  "icloud.con": "icloud.com",
  "iclod.com": "icloud.com",
};

export type EmailResult = { ok: true; value: string } | { ok: false; error: string };

export function checkEmail(raw: string): EmailResult {
  const value = raw.trim().toLowerCase();
  if (!value) return { ok: false, error: "Informe seu e-mail" };
  if (value.length > 255 || !EMAIL_RE.test(value) || value.includes("..")) {
    return { ok: false, error: "E-mail inválido" };
  }
  const domain = value.slice(value.lastIndexOf("@") + 1);
  const fix = TYPOS[domain];
  if (fix)
    return {
      ok: false,
      error: `Você quis dizer ${value.slice(0, value.lastIndexOf("@"))}@${fix}?`,
    };
  if (DISPOSABLE.has(domain))
    return { ok: false, error: "Use um e-mail pessoal (e-mails temporários não são aceitos)" };
  return { ok: true, value };
}

// --- Brazilian mobile (WhatsApp) ---------------------------------------------
// Valid Anatel area codes (DDD).
const DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** The 11 national digits (DDD + 9 + 8), taken from whatever the visitor typed. */
export function brNationalDigits(raw: string): string {
  let d = raw.replace(/\D+/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2); // +55 country code
  if (d.startsWith("0")) d = d.replace(/^0+/, ""); // trunk prefix "0"
  return d.slice(0, 11);
}

/** "(11) 98765-4321" style display mask, applied while typing. */
export function formatBrPhone(raw: string): string {
  const d = brNationalDigits(raw);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string };

export function checkBrMobile(raw: string): PhoneResult {
  const d = brNationalDigits(raw);
  if (!d) return { ok: false, error: "Informe seu WhatsApp com DDD" };
  if (d.length < 11) return { ok: false, error: "Número incompleto: DDD + 9 dígitos" };
  if (!DDD.has(Number(d.slice(0, 2)))) return { ok: false, error: "DDD inválido" };
  if (d[2] !== "9") return { ok: false, error: "Informe um celular (começa com 9 após o DDD)" };
  const local = d.slice(3);
  if (/^(\d)\1{7}$/.test(local)) {
    return { ok: false, error: "Número de celular inválido" };
  }
  return { ok: true, e164: `+55${d}` };
}
