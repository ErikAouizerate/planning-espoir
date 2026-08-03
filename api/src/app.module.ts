import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { PlanningModule } from './planning/planning.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PlanningModule, AuthModule],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useExisting: AuthGuard }],
})
export class AppModule {}
