import { currentMonthKey, monthGrid, shiftMonth, weekdayLabel } from './dates';

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
});
