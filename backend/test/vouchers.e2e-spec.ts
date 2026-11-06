import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  login,
  auth,
  adminToken,
  getAccounts,
  acct,
  getCashFlowItemId,
  createAndPostVoucher,
} from './test-utils';

describe('凭证引擎 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('借贷不平衡的凭证被拒绝(400)', async () => {
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const capital = acct(accounts, '4001');
    const bk = await login(app, 'bookkeeper', 'bookkeeper123');
    await request(app.getHttpServer())
      .post('/api/vouchers')
      .set(auth(bk.body.access_token))
      .send({
        bookId: 1,
        period: '2026-01',
        date: '2026-01-15',
        voucherType: '记',
        entries: [
          { summary: '测试', accountId: cash.id, direction: 'debit', amount: '100.00' },
          { summary: '测试', accountId: capital.id, direction: 'credit', amount: '99.00' },
        ],
      })
      .expect(400);
  });

  it('完整流程：录入→提交→审核→记账', async () => {
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const capital = acct(accounts, '4001');
    const cfid = await getCashFlowItemId(app);
    const v = await createAndPostVoucher(app, [
      { summary: '投资款', accountId: cash.id, direction: 'debit', amount: '50000.00', cashflowItemId: cfid },
      { summary: '投资款', accountId: capital.id, direction: 'credit', amount: '50000.00' },
    ]);
    expect(v.status).toBe('posted');
    expect(v.voucherNo).toBeGreaterThanOrEqual(1);
  });

  it('已记账凭证禁止修改(400)', async () => {
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const capital = acct(accounts, '4001');
    const cfid = await getCashFlowItemId(app);
    const v = await createAndPostVoucher(app, [
      { summary: '投资款2', accountId: cash.id, direction: 'debit', amount: '1000.00', cashflowItemId: cfid },
      { summary: '投资款2', accountId: capital.id, direction: 'credit', amount: '1000.00' },
    ]);
    await request(app.getHttpServer())
      .patch(`/api/vouchers/${v.id}`)
      .set(auth(await adminToken(app)))
      .send({ attachmentCount: 9 })
      .expect(400);
  });

  it('红字冲销生成反向凭证并冲减余额', async () => {
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const capital = acct(accounts, '4001');
    const cfid = await getCashFlowItemId(app);
    const v = await createAndPostVoucher(app, [
      { summary: '冲销测试', accountId: cash.id, direction: 'debit', amount: '2000.00', cashflowItemId: cfid },
      { summary: '冲销测试', accountId: capital.id, direction: 'credit', amount: '2000.00' },
    ]);
    const rv = await request(app.getHttpServer())
      .post(`/api/vouchers/${v.id}/reverse`)
      .set(auth(await adminToken(app)))
      .expect(201);
    expect(rv.body.status).toBe('posted');
    expect(rv.body.voucherNo).toBeGreaterThan(v.voucherNo);
  });
});
