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

describe('账簿查询 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    // 先过账一笔：借库存现金 30000 / 贷实收资本 30000
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const capital = acct(accounts, '4001');
    const cfid = await getCashFlowItemId(app);
    await createAndPostVoucher(app, [
      { summary: '账簿测试投资', accountId: cash.id, direction: 'debit', amount: '30000.00', cashflowItemId: cfid },
      { summary: '账簿测试投资', accountId: capital.id, direction: 'credit', amount: '30000.00' },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('试算平衡：借贷平衡', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ledgers/trial-balance?bookId=1&period=2026-01')
      .set(auth(await adminToken(app)))
      .expect(200);
    expect(res.body.balanced).toBe(true);
  });

  it('总账包含库存现金与实收资本', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ledgers/general?bookId=1&period=2026-01')
      .set(auth(await adminToken(app)))
      .expect(200);
    const body = JSON.stringify(res.body);
    expect(body).toContain('库存现金');
    expect(body).toContain('实收资本');
  });

  it('明细账可按科目查询', async () => {
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    await request(app.getHttpServer())
      .get(`/api/ledgers/detail?bookId=1&period=2026-01&accountId=${cash.id}`)
      .set(auth(await adminToken(app)))
      .expect(200);
  });

  it('现金日记账可查询', async () => {
    await request(app.getHttpServer())
      .get('/api/ledgers/journal?bookId=1&period=2026-01&type=cash')
      .set(auth(await adminToken(app)))
      .expect(200);
  });

  it('科目余额表可查询', async () => {
    await request(app.getHttpServer())
      .get('/api/ledgers/account-balance?bookId=1&period=2026-01')
      .set(auth(await adminToken(app)))
      .expect(200);
  });
});
