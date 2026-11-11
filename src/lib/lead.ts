import { z } from "zod";
import { checkBrMobile, checkEmail, checkName } from "./validation";

export const experienceOptions = [
  { value: "none", label: "Nunca operei" },
  { value: "beginner", label: "Iniciante (já testei)" },
  { value: "experienced", label: "Experiente" },
] as const;

export const goalOptions = [
  { value: "extra_income", label: "Renda extra mensal" },
  { value: "grow_savings", label: "Fazer meu patrimônio crescer" },
  { value: "inflation", label: "Proteger contra inflação" },
  { value: "learn", label: "Aprender a operar" },
] as const;

export const depositOptions = [
  { value: "yes", label: "Sim, começo com US$250+" },
  { value: "not_yet", label: "Ainda não" },
] as const;

// Runs a shared check (src/lib/validation.ts) as a zod refinement, so the
// form and the server reject exactly the same input with the same message.
const checked = (check: (v: string) => { ok: true } | { ok: false; error: string }) =>
  z.string().superRefine((v, ctx) => {
    const r = check(v);
    if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error });
  });

export const leadSchema = z.object({
  firstName: checked((v) => checkName(v, "nome")).transform((v) => v.trim().replace(/\s+/g, " ")),
  lastName: checked((v) => checkName(v, "sobrenome")).transform((v) =>
    v.trim().replace(/\s+/g, " "),
  ),
  email: checked(checkEmail).transform((v) => v.trim().toLowerCase()),
  phone: checked(checkBrMobile),
  over30: z.literal(true, {
    errorMap: () => ({ message: "Disponível apenas para maiores de 30 anos" }),
  }),
  experience: z.enum(["none", "beginner", "experienced"], {
    errorMap: () => ({ message: "Responda todas as perguntas" }),
  }),
  goal: z.enum(["extra_income", "grow_savings", "inflation", "learn"], {
    errorMap: () => ({ message: "Responda todas as perguntas" }),
  }),
  deposit: z.enum(["yes", "not_yet"], {
    errorMap: () => ({ message: "Responda todas as perguntas" }),
  }),
  consent: z.literal(true, { errorMap: () => ({ message: "Aceite os termos para continuar" }) }),
  utm: z.record(z.string().max(200)).optional(),
  clickId: z.string().max(128).optional(),
  // Honeypot: hidden field real visitors never fill. Filled leads are flagged is_bot.
  website: z.string().max(200).optional(),
  // Milliseconds from the form appearing to submit; very fast submits are flagged is_bot.
  fillMs: z.number().int().min(0).optional(),
  // Cloudflare Turnstile token; the server rejects the lead without a valid one.
  captchaToken: z.string().max(2048).optional(),
});

export type Lead = z.infer<typeof leadSchema>;
/** Contact fields that get their own inline error in the form. */
export type LeadField = "firstName" | "lastName" | "email" | "phone";
export type LeadScore = "high" | "medium" | "low";

/** Ready-to-deposit leads are the priority; experience and income goals raise quality. */
export function scoreLead(l: Pick<Lead, "experience" | "goal" | "deposit">): LeadScore {
  if (l.deposit === "not_yet") return "low";
  if (l.experience !== "none" || l.goal === "extra_income" || l.goal === "grow_savings")
    return "high";
  return "medium";
}
