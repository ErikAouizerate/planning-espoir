import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AuthGuard,
      useFactory: (config: ConfigService): AuthGuard => {
        const authEnabled = (config.get<string>('AUTH_ENABLED') ?? 'true') !== 'false';
        const issuer =
          config.get<string>('KEYCLOAK_ISSUER') ?? 'http://localhost:8080/realms/gateway';
        return new AuthGuard({ authEnabled, issuer });
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
