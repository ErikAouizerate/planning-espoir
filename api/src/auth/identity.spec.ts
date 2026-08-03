import { resolveUsername } from './identity';

describe('resolveUsername', () => {
  it('returns the provided username when present', () => {
    expect(resolveUsername('admin@example.com')).toBe('admin@example.com');
  });

  it('returns the mock user when the username is null', () => {
    expect(resolveUsername(null)).toBe('test-user');
  });

  it('returns the mock user when the username is undefined', () => {
    expect(resolveUsername(undefined)).toBe('test-user');
  });
});
