import { afterEach, describe, expect, it, vi } from "vitest";
import { createFormTimer, timingSchema } from "@/lib/form-timing";

afterEach(() => vi.restoreAllMocks());

describe("createFormTimer", () => {
  it("records per-field focus, input and click times", () => {
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => t);
    const timer = createFormTimer();
    t = 1_000;
    timer.formLoaded();
    t = 2_000;
    timer.focus("email");
    t = 2_500;
    timer.input("email");
    t = 3_000;
    timer.input("email");
    t = 4_000;
    timer.blur("email");
    t = 6_000;
    timer.focus("email");
    t = 7_000;
    timer.blur("email");
    t = 8_000;
    timer.continueClick();
    t = 9_000;
    timer.input("goal");
    t = 10_000;
    timer.submitClick();
    t = 12_000;
    const timing = timer.submitClick();

    expect(timingSchema.safeParse(timing).success).toBe(true);
    expect(timing).toMatchObject({
      form_loaded_ms: 1_000,
      continue_click_ms: 8_000,
      first_submit_click_ms: 10_000,
      submit_click_ms: 12_000,
      submit_clicks: 2,
      form_fill_ms: 11_000,
    });
    expect(timing.fields.email).toEqual({
      first_focus_ms: 2_000,
      last_blur_ms: 7_000,
      focus_total_ms: 3_000,
      first_input_ms: 2_500,
      last_input_ms: 3_000,
      input_count: 2,
    });
    expect(timing.fields.goal).toEqual({
      first_input_ms: 9_000,
      last_input_ms: 9_000,
      input_count: 1,
    });
  });
});
