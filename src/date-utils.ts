const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const invalidDate = (): Date => new Date(Number.NaN);

/**
 * Parse a calendar-only value without letting the Date constructor treat it as
 * UTC. Date inputs and Google Sheets date keys represent a local calendar day,
 * so shifting them across a timezone boundary changes their meaning.
 */
export const parseLocalDate = (value: string | Date): Date => {
  if (value instanceof Date) return new Date(value.getTime());

  const text = String(value).trim();
  const match = DATE_ONLY_PATTERN.exec(text);
  if (!match) return new Date(text);

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return invalidDate();
  }

  return date;
};

export const formatDateKey = (value: string | Date): string => {
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return String(value).trim().slice(0, 10);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getLocalWeekday = (value: string | Date): number =>
  parseLocalDate(value).getDay();
