import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, adminToken, auth } from './test-utils';

describe('账套与科目 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('创建小企业账套并自动导入 66 科目 + 12 期间', async () => {
    const token = await adminToken(app);
    const res = await request(app.getHttpServer())
      .post('/api/books')
      .set(auth(token))
      .send({
        name: 'E2E小企业账套',
        accountingStandard: 'small',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    const bookId = res.body.id;
    expect(res.body.accountingStandard).toBe('small');

    const acctRes = await request(app.getHttpServer())
      .get(`/api/accounts?bookId=${bookId}`)
      .set(auth(token))
      .expect(200);
    expect(acctRes.body.length).toBe(66);
  });

  it('科目编码唯一（重复编码拒绝）', async () => {
    const token = await adminToken(app);
    await request(app.getHttpServer())
      .post('/api/accounts')
      .set(auth(token))
      .send({
        bookId: 1,
        code: '1001',
        name: '重复库存现金',
        category: 'asset',
        balanceSide: 'debit',
      })
      .expect(400);
  });

  it('辅助核算项可创建并查询', async () => {
    const token = await adminToken(app);
    await request(app.getHttpServer())
      .post('/api/auxiliary')
      .set(auth(token))
      .send({ bookId: 1, auxType: 'customer', code: 'C-001', name: '测试客户' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .get('/api/auxiliary?bookId=1&auxType=customer')
      .set(auth(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
