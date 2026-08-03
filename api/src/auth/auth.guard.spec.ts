import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

function makeContext(headers: Record<string, string | undefined>): ExecutionContext {
  const request: { headers: Record<string, string | undefined>; user?: { username: string } } = {
    headers,
    user: undefined,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  it('passes and sets the mock user when auth is disabled', async () => {
    const guard = new AuthGuard({ authEnabled: false });
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest() as { user?: { username: string } };
    expect(req.user).toEqual({ username: 'test-user' });
  });

  it('throws 401 when auth is enabled and no token is present', async () => {
    const guard = new AuthGuard({
      authEnabled: true,
      issuer: 'http://localhost:8080/realms/gateway',
    });
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when auth is enabled and the token is not a Bearer token', async () => {
    const guard = new AuthGuard({
      authEnabled: true,
      issuer: 'http://localhost:8080/realms/gateway',
    });
    await expect(
      guard.canActivate(makeContext({ authorization: 'Basic abc' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
