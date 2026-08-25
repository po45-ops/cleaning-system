import { describe, expect, it } from "vitest";
import { getAcademicWeekNumber, isAcademicWeekInTerm } from "./report-utils";

describe("getAcademicWeekNumber", () => {
  const semesterStart = "2026-05-18";

  it("keeps Monday through Sunday in the same academic week", () => {
    expect(getAcademicWeekNumber("2026-05-18", semesterStart)).toBe(1);
    expect(getAcademicWeekNumber("2026-05-24", semesterStart)).toBe(1);
    expect(getAcademicWeekNumber("2026-05-25", semesterStart)).toBe(2);
  });

  it("returns zero before the semester and for invalid dates", () => {
    expect(getAcademicWeekNumber("2026-05-17", semesterStart)).toBe(0);
    expect(getAcademicWeekNumber("not-a-date", semesterStart)).toBe(0);
  });
});

describe("isAcademicWeekInTerm", () => {
  it("accepts only weeks 1 through 21 by default", () => {
    expect(isAcademicWeekInTerm(1)).toBe(true);
    expect(isAcademicWeekInTerm(21)).toBe(true);
    expect(isAcademicWeekInTerm(0)).toBe(false);
    expect(isAcademicWeekInTerm(22)).toBe(false);
  });
});
