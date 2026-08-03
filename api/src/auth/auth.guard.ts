import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { JWTClaimValidationFailed, JWTExpired, JWSSignatureVerificationFailed } from 'jose/errors';
import { MOCK_USERNAME } from './identity';

export const APP_GROUP = 'app-planning-espoir';

export interface AuthenticatedRequest extends Request {
  headers: Record<string, string | undefined> & Request['headers'];
  user?: { username: string };
}

export interface AuthGuardOptions {
  authEnabled: boolean;
  issuer?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;

  constructor(private readonly options: AuthGuardOptions) {
    this.jwks = options.authEnabled
      ? createRemoteJWKSet(
          new URL(
            `${(options.issuer ?? 'http://localhost:8080/realms/gateway').replace(/\/$/, '')}/protocol/openid-connect/certs`,
          ),
        )
      : null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!this.options.authEnabled) {
      request.user = { username: MOCK_USERNAME };
      return true;
    }

    const authorization = request.headers['authorization'];
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid bearer token');
    }

    const token = authorization.slice('Bearer '.length);
    try {
      const { payload } = await jwtVerify(token, this.jwks as never, {
        issuer: this.options.issuer,
      });
      const groups = (payload.groups as string[] | undefined) ?? [];
      if (!groups.includes(APP_GROUP)) {
        throw new ForbiddenException('User is not allowed to access this application');
      }
      const username = (payload.preferred_username as string | undefined) ?? null;
      request.user = { username: username ?? MOCK_USERNAME };
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (
        error instanceof JWTExpired ||
        error instanceof JWTClaimValidationFailed ||
        error instanceof JWSSignatureVerificationFailed
      ) {
        throw new UnauthorizedException('Invalid token');
      }
      throw new ServiceUnavailableException('Unable to verify token against the identity provider');
    }
  }
}
