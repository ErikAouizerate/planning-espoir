export const MOCK_USERNAME = 'test-user';

export function resolveUsername(username: string | null | undefined): string {
  return username ?? MOCK_USERNAME;
}
