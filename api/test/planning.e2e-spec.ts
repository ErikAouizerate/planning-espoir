import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { buildPlanningBuffer } from './helpers/planning-workbook';

describe('Planning (e2e)', () => {
  let app: INestApplication;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'planning-e2e-'));
    process.env.DATA_DIR = dataDir;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('returns 404 for GET /api/planning before any upload', async () => {
    await request(app.getHttpServer()).get('/api/planning').expect(404);
  });

  it('uploads a planning and returns people', async () => {
    const buffer = await buildPlanningBuffer();
    const res = await request(app.getHttpServer())
      .post('/api/planning')
      .attach('file', buffer, {
        filename: 'Copie de Planning ecluse Proposition Aout 2026.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);
    expect(res.body.startDate).toBe('2026-07-27');
    expect(res.body.people).toHaveLength(2);
    expect(res.body.warnings).toEqual([]);
  });

  it('returns 400 when uploading a non-planning file', async () => {
    await request(app.getHttpServer())
      .post('/api/planning')
      .attach('file', Buffer.from('not an xlsx'), { filename: 'notes.txt' })
      .expect(400);
  });

  it('GET /api/planning returns stored people and warnings', async () => {
    const res = await request(app.getHttpServer()).get('/api/planning').expect(200);
    expect(res.body.startDate).toBe('2026-07-27');
    expect(res.body.people).toHaveLength(2);
  });

  it('GET /api/planning/schedule resolves dates through the rotation', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/planning/schedule?month=2026-08')
      .expect(200);
    expect(res.body.month).toBe('2026-08');
    const dayKeys = Object.keys(res.body.days);
    expect(dayKeys).toContain('2026-08-03'); // Monday of S2
    const monday = res.body.days['2026-08-03'];
    expect(monday).toHaveLength(2);
    // S2 Monday for person 0 is 08:30-12:00
    expect(monday[0]).toMatchObject({ name: 'TAUZIN Caroline' });
    expect(monday[0].cell).toEqual({
      type: 'shift',
      slots: [{ start: '08:30', end: '12:00' }],
    });
  });

  it('validates the month query parameter', async () => {
    await request(app.getHttpServer()).get('/api/planning/schedule?month=nope').expect(400);
  });

  it('round-trips config via GET/PUT', async () => {
    const before = await request(app.getHttpServer()).get('/api/planning/config').expect(200);
    expect(before.body).toEqual({ startDate: '2026-07-27', defaultName: null });
    const put = await request(app.getHttpServer())
      .put('/api/planning/config')
      .send({ startDate: '2026-08-01' })
      .expect(200);
    expect(put.body.startDate).toBe('2026-08-01');
    const after = await request(app.getHttpServer()).get('/api/planning/config').expect(200);
    expect(after.body.startDate).toBe('2026-08-01');
  });

  it('rejects a malformed startDate on PUT', async () => {
    await request(app.getHttpServer())
      .put('/api/planning/config')
      .send({ startDate: 'not-a-date' })
      .expect(400);
  });
});
