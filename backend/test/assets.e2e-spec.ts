import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  adminToken,
  auth,
  getAccounts,
  acct,
} from './test-utils';

describe('固定资产 (e2e)', () => {
  let app: INestApplication;
  let assetId: number;

  beforeAll(async () => {
    app = await createTestApp();
    const accounts = await getAccounts(app);
    const deprAcc = acct(accounts, '660205'); // 管理费用-折旧费
    const accumDepr = acct(accounts, '1602'); // 累计折旧
    const res = await request(app.getHttpServer())
      .post('/api/assets')
      .set(auth(await adminToken(app)))
      .send({
        bookId: 1,
        code: 'FA-E2E-001',
        name: '测试设备',
        originalValue: '120000.00',
        residualRate: '0.05',
        usefulLife: 60,
        startDate: '2026-01-01',
        depreciationAccountId: deprAcc.id,
        accumulatedDepreciationAccountId: accumDepr.id,
      })
      .expect(201);
    assetId = res.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('计提折旧：月折旧额 = 原值×(1-残值率)/月数 = 1900.00', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/assets/${assetId}/depreciate?period=2026-07`)
      .set(auth(await adminToken(app)))
      .expect(201);
    expect(Number(res.body.amount)).toBe(1900);
  });

  it('同一期间重复计提被拒绝(409)', async () => {
    await request(app.getHttpServer())
      .post(`/api/assets/${assetId}/depreciate?period=2026-07`)
      .set(auth(await adminToken(app)))
      .expect(409);
  });
});
