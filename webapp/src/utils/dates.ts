const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthGrid(month: string): (string | null)[][] {
  const [year, monthIndex] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthIndex - 1, 1));
  const offset = (firstDay.getUTCDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();

  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function weekdayLabel(index: number): string {
  return WEEKDAY_LABELS[index];
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

export function mondaysInMonth(month: string): string[] {
  return monthDays(month).filter((date) => weekdayIndex(date) === 0);
}

function weekdayIndex(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

const MONTH_LABELS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export function monthLabel(month: string): string {
  const [, monthIndex] = month.split('-').map(Number);
  return `${MONTH_LABELS[monthIndex - 1]} ${month.slice(0, 4)}`;
}

const WEEKDAY_FULL = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export function formatFullDate(date: string): string {
  const [year, monthIndex, day] = date.split('-').map(Number);
  const weekday = weekdayIndex(date);
  return `${WEEKDAY_FULL[weekday]} ${day} ${MONTH_LABELS[monthIndex - 1]} ${year}`;
}
