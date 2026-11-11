import { describe, expect, it } from "vitest";
import { checkBrMobile, checkEmail, checkName, formatBrPhone } from "@/lib/validation";
import { leadSchema } from "@/lib/lead";

describe("checkBrMobile", () => {
  it.each([
    "(11) 98765-4321",
    "11987654321",
    "+55 11 98765-4321",
    "5511987654321",
    "011 98765 4321",
  ])("accepts %s as +5511987654321", (v) =>
    expect(checkBrMobile(v)).toEqual({ ok: true, e164: "+5511987654321" }),
  );
  it.each([
    ["", "Informe"],
    ["(11) 9876-5432", "incompleto"],
    ["(10) 98765-4321", "DDD"],
    ["(11) 38765-4321", "celular"],
    ["(11) 99999-9999", "inválido"],
  ])("rejects %s", (v, msg) => {
    const r = checkBrMobile(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });
  it("masks while typing", () => {
    expect(formatBrPhone("11")).toBe("(11");
    expect(formatBrPhone("119876")).toBe("(11) 9876");
    expect(formatBrPhone("11987654321")).toBe("(11) 98765-4321");
  });
});

describe("checkEmail", () => {
  it("accepts and lowercases", () =>
    expect(checkEmail(" Joao@Gmail.com ")).toEqual({ ok: true, value: "joao@gmail.com" }));
  it("suggests typo fixes", () => {
    const r = checkEmail("joao@hotmial.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("joao@hotmail.com");
  });
  it.each(["joao", "joao@", "joao@gmail", "jo..ao@gmail.com", "x@mailinator.com"])(
    "rejects %s",
    (v) => expect(checkEmail(v).ok).toBe(false),
  );
});

describe("checkName", () => {
  it.each(["José", "Maria da Conceição", "D'Ávila", "Ana-Lúcia"])("accepts %s", (v) =>
    expect(checkName(v, "nome").ok).toBe(true),
  );
  it.each(["J", "João123", "aaaa", "@@"])("rejects %s", (v) =>
    expect(checkName(v, "nome").ok).toBe(false),
  );
});

describe("leadSchema", () => {
  const base = {
    firstName: " José ",
    lastName: "Silva",
    email: "Jose@Gmail.com",
    phone: "(21) 99876-5432",
    over30: true,
    experience: "beginner",
    goal: "learn",
    deposit: "yes",
    consent: true,
  };
  it("normalizes a valid lead", () => {
    const r = leadSchema.parse(base);
    expect(r.firstName).toBe("José");
    expect(r.email).toBe("jose@gmail.com");
  });
  it("rejects a bad phone with the Portuguese message", () => {
    const r = leadSchema.safeParse({ ...base, phone: "123" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe("phone");
  });
});
