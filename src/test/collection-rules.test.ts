import { describe, expect, it } from "vitest";
import { businessDaysSince, isEscalaNoPrazo, nivelSla, getUltimoDiaUtil } from "@/lib/coletas";

describe("Imported collection rules", () => {
  it("counts two business days from Thursday through Monday, excluding the weekend", () => {
    expect(businessDaysSince(new Date(2026, 10, 5), new Date(2026, 10, 9))).toBe(2);
    expect(businessDaysSince(new Date(2026, 10, 6), new Date(2026, 10, 9))).toBe(1);
  });
  it("classifies 5 to 6 days as critical and 1 to 2 days as delayed", () => {
    expect(nivelSla("5 a 6 dias")).toBe("critico");
    expect(nivelSla("1 a 2 dias")).toBe("atencao");
  });
  it("treats due today and negative days as on time", () => {
    expect(isEscalaNoPrazo("Vence hoje")).toBe(true);
    expect(isEscalaNoPrazo("-1 dia")).toBe(true);
    expect(isEscalaNoPrazo("1 a 2 dias")).toBe(false);
  });
  it("uses Friday as Monday's last business day", () => {
    expect(getUltimoDiaUtil(new Date(2026, 10, 9))).toEqual(new Date(2026, 10, 6));
  });
});