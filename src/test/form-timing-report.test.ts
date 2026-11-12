import { describe, expect, it } from "vitest";
import { timingReport } from "@/lib/form-timing-report";
import type { FormTiming } from "@/lib/form-timing";

// A real log from a test submit.
const timing: FormTiming = {
  fields: {
    goal: { input_count: 1, last_input_ms: 15376, first_input_ms: 15376 },
    email: {
      input_count: 1,
      last_blur_ms: 4236,
      last_input_ms: 4003,
      first_focus_ms: 3220,
      first_input_ms: 4003,
      focus_total_ms: 1016,
    },
    phone: {
      input_count: 14,
      last_blur_ms: 10619,
      last_input_ms: 7008,
      first_focus_ms: 4239,
      first_input_ms: 4902,
      focus_total_ms: 4812,
    },
    over30: { input_count: 1, last_input_ms: 7877, first_input_ms: 7877 },
    consent: { input_count: 1, last_input_ms: 16799, first_input_ms: 16799 },
    deposit: { input_count: 1, last_input_ms: 16223, first_input_ms: 16223 },
    lastName: {
      input_count: 1,
      last_blur_ms: 3218,
      last_input_ms: 3010,
      first_focus_ms: 2120,
      first_input_ms: 3010,
      focus_total_ms: 1098,
    },
    firstName: {
      input_count: 1,
      last_blur_ms: 2116,
      last_input_ms: 1836,
      first_focus_ms: 1094,
      first_input_ms: 1836,
      focus_total_ms: 1022,
    },
    experience: { input_count: 1, last_input_ms: 11764, first_input_ms: 11764 },
  },
  timezone: "Asia/Manila",
  landed_at: "2026-11-12T12:34:20.777Z",
  form_fill_ms: 19217,
  submitted_at: "2026-11-12T12:34:40.771Z",
  submit_clicks: 1,
  form_loaded_ms: 776,
  utc_offset_min: 480,
  submit_click_ms: 19993,
  continue_click_ms: 10691,
  first_submit_click_ms: 19993,
  first_continue_click_ms: 10691,
};

describe("timingReport", () => {
  it("turns raw timing into readable text", () => {
    const r = timingReport(timing);
    if (process.env["SHOW_REPORT"]) console.log(JSON.stringify(r, null, 2));
    expect(r.landed_at).toBe("2026-11-12 20:34:20 (Asia/Manila, UTC+08:00)");
    expect(r.time_before_submit).toBe("20.0s");
    expect(r.fields["WhatsApp"]).toBe("4.8s in the field, 14 changes, typed");
    expect(r.steps[0]).toBe("0.0s - Opened the page");
    expect(r.steps.at(-1)).toBe('20.0s - Clicked "Quero começar agora" (sent)');
  });
});
