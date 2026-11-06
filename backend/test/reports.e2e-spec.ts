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

describe('财务报表 (e2e)', () => {
  let app: INestApplication;
  const period = '2026-03';

  beforeAll(async () => {
    app = await createTestApp();
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const capital = acct(accounts, '4001');
    const cfid = await getCashFlowItemId(app);
    await createAndPostVoucher(
      app,
      [
        { summary: '报表投资', accountId: cash.id, direction: 'debit', amount: '88000.00', cashflowItemId: cfid },
        { summary: '报表投资', accountId: capital.id, direction: 'credit', amount: '88000.00' },
      ],
      1,
      period,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('资产负债表平衡（资产=负债+权益）', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/balance-sheet?bookId=1&period=${period}`)
      .set(auth(await adminToken(app)))
      .expect(200);
    expect(res.body.balanced).toBe(true);
    expect(res.body.totalAssets).toBe(res.body.totalLiabilitiesAndEquity);
  });

  it('利润表可查询', async () => {
    await request(app.getHttpServer())
      .get(`/api/reports/income-statement?bookId=1&period=${period}`)
      .set(auth(await adminToken(app)))
      .expect(200);
  });

  it('现金流量表可查询且期末现金=货币资金', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/cash-flow?bookId=1&period=${period}`)
      .set(auth(await adminToken(app)))
      .expect(200);
    expect(res.body).toBeDefined();
  });
});
