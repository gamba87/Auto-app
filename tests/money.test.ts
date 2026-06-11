import { describe, expect, it } from "vitest";
import {
  assertMoneyCents,
  calculateVatFromGross,
  formatMoney,
  parseMoneyCents,
} from "@/lib/money";

describe("money helpers", () => {
  it("formats integer cents without floating point storage", () => {
    expect(formatMoney(12999)).toBe("EUR 129.99");
  });

  it("parses decimal text into cents", () => {
    expect(parseMoneyCents("129.99")).toBe(12999);
    expect(parseMoneyCents("129,9")).toBe(12990);
  });

  it("rejects floating cents", () => {
    expect(() => assertMoneyCents(12.5)).toThrow(/integer cents/);
  });

  it("calculates VAT from a VAT-inclusive gross amount", () => {
    expect(calculateVatFromGross(1210, 2100)).toBe(210);
  });
});
