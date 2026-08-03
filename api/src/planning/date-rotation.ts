const DAY_MS = 86_400_000;
const WEEK_COUNT = 6;

export function weekIndexForDate(startDate: string, date: string): number {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const dateMs = Date.parse(`${date}T00:00:00Z`);
  const diffDays = Math.floor((dateMs - startMs) / DAY_MS);
  const week = Math.floor(diffDays / 7);
  return ((week % WEEK_COUNT) + WEEK_COUNT) % WEEK_COUNT;
}

export function weekdayIndex(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

export function monthDays(month: string): string[] {
  const [year, monthIndex] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const days: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${month}-${String(d).padStart(2, '0')}`);
  }
  return days;
}
