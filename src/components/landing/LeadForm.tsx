import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { depositOptions, experienceOptions, goalOptions, leadSchema } from "@/lib/lead";
import { trackLead } from "@/lib/meta-pixel";
import { submitLead } from "@/lib/submit-lead";
import { CAPTCHA_ERROR, TURNSTILE_ACTION, TURNSTILE_SITE_KEY } from "@/lib/turnstile";
import { formatBrPhone } from "@/lib/validation";
import { Turnstile, type TurnstileHandle } from "./Turnstile";

type Opt = { value: string; label: string };

function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Opt[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-foreground">{label}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button
            type="button"
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
              value === o.value
                ? "border-accent bg-accent/15 text-foreground ring-2 ring-accent"
                : "border-input bg-background hover:border-accent"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const inputCls =
  "w-full rounded-lg border bg-background px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-ring";
const fieldCls = (bad: boolean) => `${inputCls} ${bad ? "border-destructive" : "border-input"}`;

type Step1Field = "firstName" | "lastName" | "email" | "phone";
const STEP1: Step1Field[] = ["firstName", "lastName", "email", "phone"];

/** Inline flag: emoji flags show as plain "BR" letters on Windows. */
function BrazilFlag() {
  return (
    <svg viewBox="0 0 28 20" className="h-4 w-[22px] shrink-0 rounded-[2px]" role="presentation">
      <rect width="28" height="20" fill="#009c3b" />
      <path d="M14 2.5 25.5 10 14 17.5 2.5 10Z" fill="#ffdf00" />
      <circle cx="14" cy="10" r="4.2" fill="#002776" />
    </svg>
  );
}

function FieldError({ id, msg }: { id: string; msg?: string | undefined }) {
  if (!msg) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs font-medium text-destructive">
      {msg}
    </p>
  );
}

export function LeadForm({ id }: { id?: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    over30: false,
    experience: "",
    goal: "",
    deposit: "",
    consent: false,
    website: "",
  });
  const [fieldErr, setFieldErr] = useState<Partial<Record<Step1Field, string>>>({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [utm, setUtm] = useState<Record<string, string>>({});
  const [clickId, setClickId] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const captcha = useRef<TurnstileHandle>(null);
  // When the form appeared; sent as fillMs so the server can flag instant submits.
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY)
      console.error("VITE_TURNSTILE_SITE_KEY is not set: leads will be rejected");
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const u: Record<string, string> = {};
    p.forEach((v, k) => {
      if (k.startsWith("utm_") || k === "gclid" || k === "fbclid") u[k] = v.slice(0, 200);
    });
    setUtm(u);
    setClickId((p.get("click_id") ?? p.get("clickid") ?? "").slice(0, 128));
  }, []);

  const set = (k: keyof typeof f, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  // Error for one step-1 field, using the same schema the server applies.
  const fieldError = (k: Step1Field, value = f[k]) => {
    const r = leadSchema.shape[k].safeParse(value);
    return r.success ? undefined : r.error.issues[0]?.message;
  };
  const validate = (k: Step1Field) => setFieldErr((e) => ({ ...e, [k]: fieldError(k) }));
  // While typing, only clear an error once the value becomes valid (no nagging mid-word).
  const change = (k: Step1Field, v: string) => {
    set(k, v);
    if (fieldErr[k] && !fieldError(k, v)) setFieldErr((e) => ({ ...e, [k]: undefined }));
  };

  const next = () => {
    const errs = Object.fromEntries(STEP1.map((k) => [k, fieldError(k)])) as Partial<
      Record<Step1Field, string>
    >;
    setFieldErr(errs);
    const firstBad = STEP1.find((k) => errs[k]);
    if (firstBad) {
      document.getElementById(`lead-${firstBad}`)?.focus();
      return setErr("");
    }
    if (!f.over30) return setErr("Disponível apenas para maiores de 30 anos");
    setErr("");
    setStep(2);
  };

  const submit = async () => {
    const r = leadSchema.safeParse({
      ...f,
      utm,
      clickId: clickId || undefined,
      website: f.website || undefined,
      captchaToken: captchaToken || undefined,
      fillMs: shownAt.current ? Math.max(0, Date.now() - shownAt.current) : undefined,
    });
    if (!r.success) {
      const issue = r.error.issues[0];
      const k = issue?.path[0] as Step1Field;
      if (STEP1.includes(k)) {
        setStep(1);
        setFieldErr({ [k]: issue?.message });
        return;
      }
      return setErr(issue?.message ?? "Erro");
    }
    if (!r.data.captchaToken) return setErr(CAPTCHA_ERROR);
    setErr("");
    setLoading(true);
    try {
      const res = await submitLead(r.data);
      // Tokens work once: get a new one for the next attempt.
      if (!res.ok) captcha.current?.reset();
      if (res.ok) {
        // Honeypot leads reach the CRM flagged as bots; don't count them for Meta.
        if (!r.data.website) trackLead();
        setStep(3);
        // Same tab, once the thank-you screen has had a moment to show.
        const url = res.autologinUrl;
        if (url) setTimeout(() => window.location.assign(url), 1500);
      } else if (res.field) {
        setStep(1);
        setFieldErr({ [res.field]: res.error });
      } else setErr(res.error);
    } catch {
      captcha.current?.reset();
      setErr("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const a11y = (k: Step1Field) => ({
    id: `lead-${k}`,
    "aria-invalid": !!fieldErr[k],
    "aria-describedby": fieldErr[k] ? `lead-${k}-err` : undefined,
    onBlur: () => {
      if (f[k]) validate(k);
    },
  });

  return (
    <div
      id={id}
      className="scroll-mt-24 self-center rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-card sm:p-8"
    >
      {step === 3 ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
          <h3 className="mt-4 text-2xl font-bold">Cadastro recebido, {f.firstName}!</h3>
          <p className="mt-2 text-muted-foreground">
            Um especialista entrará em contato via WhatsApp em breve. Fique de olho no seu celular.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-bold">
              {step === 1 ? "Abra sua conta grátis" : "Só mais 3 perguntas"}
            </h3>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              Passo {step} de 2
            </span>
          </div>
          <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gold-gradient transition-all"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>

          {step === 1 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <input
                    {...a11y("firstName")}
                    className={fieldCls(!!fieldErr.firstName)}
                    placeholder="Nome"
                    autoComplete="given-name"
                    value={f.firstName}
                    onChange={(e) => change("firstName", e.target.value)}
                    maxLength={50}
                  />
                  <FieldError id="lead-firstName-err" msg={fieldErr.firstName} />
                </div>
                <div>
                  <input
                    {...a11y("lastName")}
                    className={fieldCls(!!fieldErr.lastName)}
                    placeholder="Sobrenome"
                    autoComplete="family-name"
                    value={f.lastName}
                    onChange={(e) => change("lastName", e.target.value)}
                    maxLength={50}
                  />
                  <FieldError id="lead-lastName-err" msg={fieldErr.lastName} />
                </div>
              </div>
              <div>
                <input
                  {...a11y("email")}
                  className={fieldCls(!!fieldErr.email)}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Seu melhor e-mail"
                  value={f.email}
                  onChange={(e) => change("email", e.target.value.replace(/\s/g, ""))}
                  maxLength={255}
                />
                <FieldError id="lead-email-err" msg={fieldErr.email} />
              </div>
              <div>
                {/* Prefix and input share one border, so they always line up and never wrap apart. */}
                <div
                  className={`flex items-stretch overflow-hidden rounded-lg border bg-background focus-within:border-accent focus-within:ring-2 focus-within:ring-ring ${
                    fieldErr.phone ? "border-destructive" : "border-input"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex shrink-0 items-center gap-2 whitespace-nowrap border-r border-input bg-muted px-3 text-base font-semibold text-muted-foreground"
                  >
                    <BrazilFlag />
                    +55
                  </span>
                  <input
                    {...a11y("phone")}
                    aria-label="WhatsApp com DDD (+55)"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base outline-none"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="(11) 98765-4321"
                    value={f.phone}
                    onChange={(e) => change("phone", formatBrPhone(e.target.value))}
                    maxLength={16}
                  />
                </div>
                <FieldError id="lead-phone-err" msg={fieldErr.phone} />
              </div>
              {/* Honeypot: hidden from people and screen readers; bots fill it. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                value={f.website}
                onChange={(e) => set("website", e.target.value)}
              />
              <label className="flex items-start gap-3 pt-1 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={f.over30}
                  onChange={(e) => set("over30", e.target.checked)}
                />
                Confirmo que tenho <strong>30 anos ou mais</strong>
              </label>
              {err && <p className="text-sm font-medium text-destructive">{err}</p>}
              <button
                type="button"
                onClick={next}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold-gradient px-6 py-4 text-lg font-bold text-accent-foreground shadow-gold transition hover:brightness-105"
              >
                Continuar <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <Choice
                label="1. Qual sua experiência com investimentos?"
                options={experienceOptions}
                value={f.experience}
                onChange={(v) => set("experience", v)}
              />
              <Choice
                label="2. Qual seu principal objetivo?"
                options={goalOptions}
                value={f.goal}
                onChange={(v) => set("goal", v)}
              />
              <Choice
                label="3. Pode começar com o depósito mínimo de US$250?"
                options={depositOptions}
                value={f.deposit}
                onChange={(v) => set("deposit", v)}
              />
              <label className="flex items-start gap-3 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={f.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                />
                Aceito ser contatado por telefone, WhatsApp e e-mail e concordo com a Política de
                Privacidade (LGPD).
              </label>
              {TURNSTILE_SITE_KEY && (
                <Turnstile
                  ref={captcha}
                  siteKey={TURNSTILE_SITE_KEY}
                  action={TURNSTILE_ACTION}
                  onToken={(t) => {
                    setCaptchaToken(t);
                    if (t) setCaptchaFailed(false);
                  }}
                  onError={() => setCaptchaFailed(true)}
                />
              )}
              {captchaFailed && (
                <p className="text-xs text-muted-foreground">
                  A verificação de segurança não carregou. Desative bloqueadores de anúncio para
                  este site ou recarregue a página.
                </p>
              )}
              {err && <p className="text-sm font-medium text-destructive">{err}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-input px-4 py-4 text-sm font-semibold"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={submit}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gold-gradient px-6 py-4 text-lg font-bold text-accent-foreground shadow-gold transition hover:brightness-105 disabled:opacity-60"
                >
                  {loading ? "Enviando..." : "Quero começar agora"}
                </button>
              </div>
            </div>
          )}
          <div className="mt-5 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" /> Dados protegidos
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Sem custo de cadastro
            </span>
          </div>
        </>
      )}
    </div>
  );
}
