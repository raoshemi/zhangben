import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  adminToken,
  auth,
  getAccounts,
  acct,
  getCashFlowItemId,
  createAndPostVoucher,
} from './test-utils';

describe('期末处理 (e2e)', () => {
  let app: INestApplication;
  const period = '2026-06';

  beforeAll(async () => {
    app = await createTestApp();
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const revenue = acct(accounts, '6001');
    const cfid = await getCashFlowItemId(app);
    await createAndPostVoucher(
      app,
      [
        { summary: '销售收入', accountId: cash.id, direction: 'debit', amount: '12000.00', cashflowItemId: cfid },
        { summary: '销售收入', accountId: revenue.id, direction: 'credit', amount: '12000.00' },
      ],
      1,
      period,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('损益结转：收入转入本年利润', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/closing/profit-transfer?bookId=1&period=${period}`)
      .set(auth(await adminToken(app)))
      .expect(201);
    expect(Number(res.body.netProfit)).toBe(12000);
  });

  it('结账：期间状态置为 closed', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/closing/close?bookId=1&period=${period}`)
      .set(auth(await adminToken(app)))
      .expect(201);
    expect(res.body.status).toBe('closed');
  });

  it('反结账：期间状态恢复 open', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/closing/reopen?bookId=1&period=${period}`)
      .set(auth(await adminToken(app)))
      .expect(201);
    expect(res.body.status).toBe('open');
  });
});
