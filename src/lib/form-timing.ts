import { z } from "zod";

// Records when the visitor landed, how they filled each form field, and when they clicked.
// Sent with the lead and forwarded only to the leads log (never to the CRM).
// Every *_ms value is milliseconds since the visitor entered the page (performance.now()).

export const TIMED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "over30",
  "experience",
  "goal",
  "deposit",
  "consent",
] as const;
export type TimedField = (typeof TIMED_FIELDS)[number];

const ms = z
  .number()
  .int()
  .min(0)
  .max(7 * 86_400_000);
const count = z.number().int().min(0).max(10_000);

const fieldTimingSchema = z.object({
  /** First time the field got focus (text fields only). */
  first_focus_ms: ms.optional(),
  /** Last time the field lost focus (text fields only). */
  last_blur_ms: ms.optional(),
  /** Total time the field had focus, over all visits (text fields only). */
  focus_total_ms: ms.optional(),
  /** First and last time the value changed (typing, choosing an option, ticking a box). */
  first_input_ms: ms.optional(),
  last_input_ms: ms.optional(),
  /** Number of value changes (keystrokes, clicks). */
  input_count: count.optional(),
});
export type FieldTiming = z.infer<typeof fieldTimingSchema>;

export const timingSchema = z.object({
  /** When the visitor entered the landing page (ISO, UTC). */
  landed_at: z.string().max(40),
  /** When the visitor clicked submit (ISO, UTC). */
  submitted_at: z.string().max(40),
  /** Visitor's own time zone and UTC offset in minutes, e.g. "America/Sao_Paulo", -180. */
  timezone: z.string().max(64).optional(),
  utc_offset_min: z.number().int().min(-900).max(900).optional(),
  form_loaded_ms: ms.optional(),
  /** "Continuar" (step 1 → 2): first and last click. */
  first_continue_click_ms: ms.optional(),
  continue_click_ms: ms.optional(),
  /** "Quero começar agora": first and latest click, and how many times. */
  first_submit_click_ms: ms.optional(),
  submit_click_ms: ms,
  submit_clicks: count.optional(),
  /** submit_click_ms − form_loaded_ms. */
  form_fill_ms: ms.optional(),
  fields: z.object(
    Object.fromEntries(TIMED_FIELDS.map((k) => [k, fieldTimingSchema.optional()])) as Record<
      TimedField,
      z.ZodOptional<typeof fieldTimingSchema>
    >,
  ),
});
export type FormTiming = z.infer<typeof timingSchema>;

const now = () => Math.round(performance.now());

export function createFormTimer() {
  const fields: Partial<Record<TimedField, FieldTiming>> = {};
  const focusedSince: Partial<Record<TimedField, number>> = {};
  let formLoaded: number | undefined;
  let firstContinue: number | undefined;
  let lastContinue: number | undefined;
  let firstSubmit: number | undefined;
  let submitClicks = 0;
  const field = (k: TimedField) => (fields[k] ??= {});

  return {
    formLoaded() {
      formLoaded ??= now();
    },
    focus(k: TimedField) {
      const t = now();
      field(k).first_focus_ms ??= t;
      focusedSince[k] = t;
    },
    blur(k: TimedField) {
      const t = now();
      const f = field(k);
      f.last_blur_ms = t;
      const since = focusedSince[k];
      if (since !== undefined) f.focus_total_ms = (f.focus_total_ms ?? 0) + (t - since);
      delete focusedSince[k];
    },
    input(k: TimedField) {
      const t = now();
      const f = field(k);
      f.first_input_ms ??= t;
      f.last_input_ms = t;
      f.input_count = (f.input_count ?? 0) + 1;
    },
    continueClick() {
      lastContinue = now();
      firstContinue ??= lastContinue;
    },
    /** Call on each submit click; returns the payload to send. */
    submitClick(): FormTiming {
      const t = now();
      firstSubmit ??= t;
      submitClicks += 1;
      let tz: string | undefined;
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        // old browser
      }
      return {
        landed_at: new Date(performance.timeOrigin).toISOString(),
        submitted_at: new Date().toISOString(),
        timezone: tz,
        utc_offset_min: -new Date().getTimezoneOffset(),
        form_loaded_ms: formLoaded,
        first_continue_click_ms: firstContinue,
        continue_click_ms: lastContinue,
        first_submit_click_ms: firstSubmit,
        submit_click_ms: t,
        submit_clicks: submitClicks,
        form_fill_ms: formLoaded !== undefined ? t - formLoaded : undefined,
        fields: structuredClone(fields),
      };
    },
  };
}
