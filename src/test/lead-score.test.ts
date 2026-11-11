import { describe, expect, it } from "vitest";
import { scoreLead } from "@/lib/lead";

describe("scoreLead", () => {
  it("is low when the lead cannot deposit US$250 yet", () => {
    expect(scoreLead({ deposit: "not_yet", experience: "experienced", goal: "extra_income" })).toBe("low");
  });
  it("is high for ready depositors with experience", () => {
    expect(scoreLead({ deposit: "yes", experience: "beginner", goal: "learn" })).toBe("high");
  });
  it("is medium for ready beginners only wanting to learn", () => {
    expect(scoreLead({ deposit: "yes", experience: "none", goal: "learn" })).toBe("medium");
  });
});
