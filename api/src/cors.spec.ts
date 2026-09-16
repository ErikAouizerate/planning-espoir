import { parseCorsOrigins } from './cors';

describe('parseCorsOrigins', () => {
  it('returns an empty list when unset or blank', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins('  ,  ')).toEqual([]);
  });

  it('splits, trims and drops empty entries', () => {
    expect(parseCorsOrigins('https://a.example, https://b.example ,')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});
