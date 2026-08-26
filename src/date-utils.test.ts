import { describe, expect, it } from "vitest";

import { formatDateKey, getLocalWeekday, parseLocalDate } from "./date-utils";

describe("local calendar dates", () => {
  it("preserves a date-only key in every runtime timezone", () => {
    expect(formatDateKey("2026-08-26")).toBe("2026-08-26");

    const date = parseLocalDate("2026-08-26");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(26);
  });

  it("calculates weekdays from the intended local calendar day", () => {
    expect(getLocalWeekday("2026-08-29")).toBe(6);
    expect(getLocalWeekday("2026-08-30")).toBe(0);
    expect(getLocalWeekday("2026-08-31")).toBe(1);
  });

  it("does not normalize an impossible date into another day", () => {
    expect(parseLocalDate("2026-02-30").getTime()).toBeNaN();
    expect(formatDateKey("2026-02-30")).toBe("2026-02-30");
  });
});
