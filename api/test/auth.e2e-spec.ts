import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function buildApp(
  authEnabled: string,
): Promise<{ app: INestApplication; cleanup: () => Promise<void> }> {
  const dataDir = await mkdtemp(join(tmpdir(), 'auth-e2e-'));
  process.env.DATA_DIR = dataDir;
  process.env.AUTH_ENABLED = authEnabled;
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return {
    app,
    cleanup: async () => {
      await app.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

describe('Auth (e2e)', () => {
  it('returns the mock user and allows planning when auth is disabled', async () => {
    const { app, cleanup } = await buildApp('false');
    try {
      const me = await request(app.getHttpServer()).get('/api/auth/me').expect(200);
      expect(me.body).toEqual({ username: 'test-user' });
      await request(app.getHttpServer()).get('/api/planning').expect(404); // guard passed, no planning uploaded
    } finally {
      await cleanup();
    }
  });

  it('returns 401 for /auth/me and /planning when auth is enabled and no token is sent', async () => {
    const { app, cleanup } = await buildApp('true');
    try {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
      await request(app.getHttpServer()).get('/api/planning').expect(401);
    } finally {
      await cleanup();
    }
  });
});
