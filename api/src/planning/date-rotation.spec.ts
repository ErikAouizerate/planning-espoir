import {
  isValidDateKey,
  isValidMonth,
  monthDays,
  weekIndexForDate,
  weekdayIndex,
} from './date-rotation';

describe('date-rotation', () => {
  const start = '2026-07-27'; // a Monday

  it('returns S1 index for the start date itself', () => {
    expect(weekIndexForDate(start, '2026-07-27')).toBe(0);
  });

  it('advances one week per 7 days', () => {
    expect(weekIndexForDate(start, '2026-08-03')).toBe(1); // S2
    expect(weekIndexForDate(start, '2026-08-31')).toBe(5); // S6
  });

  it('cycles back to S1 after six weeks', () => {
    expect(weekIndexForDate(start, '2026-09-07')).toBe(0);
    expect(weekIndexForDate(start, '2026-09-14')).toBe(1);
  });

  it('wraps correctly for dates before the start date', () => {
    expect(weekIndexForDate(start, '2026-07-20')).toBe(5);
  });

  it('maps weekday to Monday=0..Sunday=6', () => {
    expect(weekdayIndex('2026-07-27')).toBe(0); // Monday
    expect(weekdayIndex('2026-08-02')).toBe(6); // Sunday
  });

  it('lists every day of a month', () => {
    const days = monthDays('2026-08');
    expect(days.length).toBe(31);
    expect(days[0]).toBe('2026-08-01');
    expect(days[days.length - 1]).toBe('2026-08-31');
  });

  it('isValidMonth accepts real months only', () => {
    expect(isValidMonth('2026-01')).toBe(true);
    expect(isValidMonth('2026-12')).toBe(true);
    expect(isValidMonth('2026-08')).toBe(true);
    expect(isValidMonth('2026-00')).toBe(false);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-99')).toBe(false);
    expect(isValidMonth('2026-8')).toBe(false);
    expect(isValidMonth('nope')).toBe(false);
    expect(isValidMonth('')).toBe(false);
  });

  it('isValidDateKey accepts real calendar dates only', () => {
    expect(isValidDateKey('2026-07-27')).toBe(true);
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('2024-02-29')).toBe(true); // leap year
    expect(isValidDateKey('2026-02-30')).toBe(false); // impossible date
    expect(isValidDateKey('2026-99-99')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2026-00-01')).toBe(false);
    expect(isValidDateKey('2026-7-27')).toBe(false); // must be zero-padded
    expect(isValidDateKey('nope')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
  });
});
