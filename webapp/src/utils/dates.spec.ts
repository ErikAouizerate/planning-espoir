import { currentMonthKey, formatFullDate, mondaysInMonth, monthGrid, monthLabel, shiftMonth, weekdayLabel } from './dates';

describe('dates utils', () => {
  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('produces a current month key', () => {
    const now = new Date();
    const expected = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    expect(currentMonthKey()).toBe(expected);
  });

  it('builds a Monday-first month grid with null padding', () => {
    // August 2026 starts on a Saturday
    const grid = monthGrid('2026-08');
    expect(grid[0]).toHaveLength(7);
    expect(grid.flat().filter((d) => d !== null)).toHaveLength(31);
    const saturday = grid.flat().findIndex((d) => d === '2026-08-01');
    expect(saturday).toBe(5); // Monday-first: index 5 is Saturday
  });

  it('labels weekdays', () => {
    expect(weekdayLabel(0)).toBe('Lun');
    expect(weekdayLabel(6)).toBe('Dim');
  });

  it('lists the Mondays of a month', () => {
    // August 2026: Mondays are the 3rd, 10th, 17th, 24th, 31st
    expect(mondaysInMonth('2026-08')).toEqual([
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
    ]);
    // February 2026: no Monday in the last week
    expect(mondaysInMonth('2026-02')).toEqual(['2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23']);
  });

  it('formats a month key as a French label', () => {
    expect(monthLabel('2026-08')).toBe('août 2026');
    expect(monthLabel('2026-01')).toBe('janvier 2026');
  });

  it('formats a date key as a full French date', () => {
    expect(formatFullDate('2026-07-27')).toBe('lundi 27 juillet 2026');
  });
});
