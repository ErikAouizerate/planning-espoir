import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './cors';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins });
  }
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
