const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function toCalendarDayNumber(value: string | Date): number | null {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);

  if (Number.isNaN(date.getTime())) return null;
  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
    MILLISECONDS_PER_DAY
  );
}

export function getAcademicWeekNumber(
  dateValue: string | Date,
  semesterStart: string | Date
): number {
  const currentDay = toCalendarDayNumber(dateValue);
  const startDay = toCalendarDayNumber(semesterStart);
  if (currentDay === null || startDay === null) return 0;
  return Math.floor((currentDay - startDay) / 7) + 1;
}

export function isAcademicWeekInTerm(
  weekNumber: number,
  totalWeeks = 21
): boolean {
  return (
    Number.isInteger(weekNumber) &&
    Number.isInteger(totalWeeks) &&
    totalWeeks > 0 &&
    weekNumber >= 1 &&
    weekNumber <= totalWeeks
  );
}
