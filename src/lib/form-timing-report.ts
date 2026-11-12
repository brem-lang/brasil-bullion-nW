import type { FieldTiming, FormTiming, TimedField } from "./form-timing";

// Turns the raw form timing (milliseconds) into a version people can read in the leads log:
// local times, seconds, a step-by-step list and one sentence per field.

const LABELS: Record<TimedField, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "WhatsApp",
  over30: "Age 30+ checkbox",
  experience: "Q1 Experience",
  goal: "Q2 Goal",
  deposit: "Q3 Deposit US$250",
  consent: "Consent checkbox",
};
const TEXT_FIELDS: readonly TimedField[] = ["firstName", "lastName", "email", "phone"];
const CHECKBOXES: readonly TimedField[] = ["over30", "consent"];
const ORDER = Object.keys(LABELS) as TimedField[];

/** 1234 → "1.2s", 65000 → "1m 05s" */
export function duration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** "2026-11-12T12:34:20.777Z" + 480 → "2026-11-12 20:34:20 (Asia/Manila, UTC+08:00)" */
function localTime(iso: string, offsetMin?: number, tz?: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t) || offsetMin === undefined) return iso;
  const local = new Date(t + offsetMin * 60_000).toISOString().slice(0, 19).replace("T", " ");
  const abs = Math.abs(offsetMin);
  const utc = `UTC${offsetMin < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return `${local} (${tz ? `${tz}, ` : ""}${utc})`;
}

const times = (n: number) => (n === 1 ? "1 time" : `${n} times`);

function describeField(k: TimedField, f: FieldTiming): string {
  const n = f.input_count ?? 0;
  if (TEXT_FIELDS.includes(k)) {
    const parts: string[] = [];
    if (f.focus_total_ms !== undefined) parts.push(`${duration(f.focus_total_ms)} in the field`);
    parts.push(n === 1 ? "1 change" : `${n} changes`);
    // A whole name/e-mail arriving in one change means the browser filled it or it was pasted.
    if (n === 1) parts.push("filled in one go (autofill or paste)");
    else if (n > 1) parts.push("typed");
    return parts.join(", ");
  }
  const at = f.last_input_ms !== undefined ? ` at ${duration(f.last_input_ms)}` : "";
  if (CHECKBOXES.includes(k)) return n > 1 ? `clicked ${times(n)}, last${at}` : `ticked${at}`;
  return n > 1 ? `answered, changed answer ${times(n - 1)}, last${at}` : `answered${at}`;
}

export type TimingReport = {
  summary: string;
  landed_at: string;
  submitted_at: string;
  time_before_submit: string;
  time_to_fill_form?: string | undefined;
  submit_clicks: number;
  steps: string[];
  fields: Record<string, string>;
};

export function timingReport(t: FormTiming): TimingReport {
  const events: { ms: number; text: string }[] = [{ ms: 0, text: "Opened the page" }];
  const add = (ms: number | undefined, text: string) => {
    if (ms !== undefined) events.push({ ms, text });
  };
  add(t.form_loaded_ms, "Form loaded");

  const fields: Record<string, string> = {};
  for (const k of ORDER) {
    const f = t.fields[k];
    if (!f) continue;
    fields[LABELS[k]] = describeField(k, f);
    if (TEXT_FIELDS.includes(k)) add(f.first_focus_ms ?? f.first_input_ms, `Started ${LABELS[k]}`);
    else add(f.last_input_ms, `${CHECKBOXES.includes(k) ? "Ticked" : "Answered"} ${LABELS[k]}`);
  }
  for (const k of ORDER) if (!t.fields[k]) fields[LABELS[k]] = "not touched";

  add(t.first_continue_click_ms, 'Clicked "Continuar"');
  if (t.continue_click_ms !== t.first_continue_click_ms)
    add(t.continue_click_ms, 'Clicked "Continuar" again (last time)');
  const clicks = t.submit_clicks ?? 1;
  if (t.first_submit_click_ms !== undefined && t.first_submit_click_ms !== t.submit_click_ms)
    add(t.first_submit_click_ms, 'Clicked "Quero começar agora" (first try)');
  add(
    t.submit_click_ms,
    `Clicked "Quero começar agora"${clicks > 1 ? ` (try ${clicks}, sent)` : " (sent)"}`,
  );

  events.sort((a, b) => a.ms - b.ms);
  const landed = localTime(t.landed_at, t.utc_offset_min, t.timezone);
  const fill = t.form_fill_ms !== undefined ? duration(t.form_fill_ms) : undefined;

  return {
    summary:
      `Landed ${landed}, submitted ${duration(t.submit_click_ms)} later` +
      (fill ? `, spent ${fill} on the form` : "") +
      `, ${clicks === 1 ? "1 submit click" : `${clicks} submit clicks`}.`,
    landed_at: landed,
    submitted_at: localTime(t.submitted_at, t.utc_offset_min, t.timezone),
    time_before_submit: duration(t.submit_click_ms),
    time_to_fill_form: fill,
    submit_clicks: clicks,
    steps: events.map((e) => `${duration(e.ms)} - ${e.text}`),
    fields,
  };
}
