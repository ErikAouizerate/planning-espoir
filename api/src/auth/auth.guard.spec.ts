import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { jwtVerify } from 'jose';
import {
  JWTClaimValidationFailed,
  JWTExpired,
  JWKSTimeout,
  JWSSignatureVerificationFailed,
} from 'jose/errors';
import { AuthGuard } from './auth.guard';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));

const mockJwtVerify = jwtVerify as jest.Mock;

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

function enabledGuard(): AuthGuard {
  return new AuthGuard({
    authEnabled: true,
    issuer: 'http://localhost:8080/realms/gateway',
  });
}

describe('AuthGuard', () => {
  beforeEach(() => {
    mockJwtVerify.mockReset();
  });

  it('passes and sets the mock user when auth is disabled', async () => {
    const guard = new AuthGuard({ authEnabled: false });
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest() as { user?: { username: string } };
    expect(req.user).toEqual({ username: 'test-user' });
  });

  it('throws 401 when auth is enabled and no token is present', async () => {
    await expect(enabledGuard().canActivate(makeContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws 401 when auth is enabled and the token is not a Bearer token', async () => {
    await expect(
      enabledGuard().canActivate(makeContext({ authorization: 'Basic abc' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('sets request.user from preferred_username when a valid token verifies', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { preferred_username: 'admin@example.com' } });
    const ctx = makeContext({ authorization: 'Bearer abc.def.ghi' });
    await expect(enabledGuard().canActivate(ctx)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest() as { user?: { username: string } };
    expect(req.user).toEqual({ username: 'admin@example.com' });
  });

  it('throws 401 when the token is expired', async () => {
    mockJwtVerify.mockRejectedValue(new JWTExpired('expired', {}));
    await expect(
      enabledGuard().canActivate(makeContext({ authorization: 'Bearer abc.def.ghi' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when a token claim fails validation', async () => {
    mockJwtVerify.mockRejectedValue(new JWTClaimValidationFailed('invalid claim', {}));
    await expect(
      enabledGuard().canActivate(makeContext({ authorization: 'Bearer abc.def.ghi' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when the token signature cannot be verified', async () => {
    mockJwtVerify.mockRejectedValue(new JWSSignatureVerificationFailed('bad signature'));
    await expect(
      enabledGuard().canActivate(makeContext({ authorization: 'Bearer abc.def.ghi' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 503 when the JWKS endpoint cannot be reached', async () => {
    mockJwtVerify.mockRejectedValue(new JWKSTimeout('jwks timeout'));
    await expect(
      enabledGuard().canActivate(makeContext({ authorization: 'Bearer abc.def.ghi' })),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
