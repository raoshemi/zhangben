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

describe('凭证补强 e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createDraft(period: string, summary = '草稿凭证') {
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const capital = acct(accounts, '4001');
    const cfid = await getCashFlowItemId(app);
    const bk = await login(app, 'bookkeeper', 'bookkeeper123');
    const res = await request(app.getHttpServer())
      .post('/api/vouchers')
      .set(auth(bk.body.access_token))
      .send({
        bookId: 1,
        period,
        date: `${period}-10`,
        voucherType: '记',
        entries: [
          { summary, accountId: cash.id, direction: 'debit', amount: '100.00', cashflowItemId: cfid },
          { summary, accountId: capital.id, direction: 'credit', amount: '100.00' },
        ],
      })
      .expect(201);
    return res.body;
  }

  it('草稿凭证可修改', async () => {
    const v = await createDraft('2026-11', '可修改');
    const token = await adminToken(app);
    const res = await request(app.getHttpServer())
      .patch(`/api/vouchers/${v.id}`)
      .set(auth(token))
      .send({ attachmentCount: 3 })
      .expect(200);
    expect(res.body.attachmentCount).toBe(3);
  });

  it('草稿凭证可作废（删除或置 voided）', async () => {
    const v = await createDraft('2026-12', '可作废');
    const token = await adminToken(app);
    const del = await request(app.getHttpServer())
      .delete(`/api/vouchers/${v.id}`)
      .set(auth(token));
    expect([200, 204]).toContain(del.status);
    const after = await request(app.getHttpServer())
      .get(`/api/vouchers/${v.id}`)
      .set(auth(token));
    if (after.status !== 404) {
      expect(after.body.status).toBe('voided');
    }
  });

  it('辅助核算可挂在凭证分录（客户）', async () => {
    const token = await adminToken(app);
    const uid = Date.now();
    const auxRes = await request(app.getHttpServer())
      .post('/api/auxiliary')
      .set(auth(token))
      .send({ bookId: 1, auxType: 'customer', code: `C${uid}`, name: `客户${uid}` })
      .expect(201);
    const customerId = auxRes.body.id;

    const accounts = await getAccounts(app);
    const ar = acct(accounts, '1122'); // 应收账款（aux customer，叶子）
    const revenue = acct(accounts, '6001');
    const bk = await login(app, 'bookkeeper', 'bookkeeper123');
    const createRes = await request(app.getHttpServer())
      .post('/api/vouchers')
      .set(auth(bk.body.access_token))
      .send({
        bookId: 1,
        period: '2026-10',
        date: '2026-10-10',
        voucherType: '记',
        entries: [
          {
            summary: '赊销',
            accountId: ar.id,
            direction: 'debit',
            amount: '1000.00',
            auxs: [{ auxType: 'customer', auxiliaryItemId: customerId }],
          },
          { summary: '赊销', accountId: revenue.id, direction: 'credit', amount: '1000.00' },
        ],
      })
      .expect(201);
    const vid = createRes.body.id;
    await request(app.getHttpServer())
      .post(`/api/vouchers/${vid}/submit`)
      .set(auth(bk.body.access_token))
      .expect(201);
    const ap = await login(app, 'approver', 'approver123');
    await request(app.getHttpServer())
      .post(`/api/vouchers/${vid}/approve`)
      .set(auth(ap.body.access_token))
      .expect(201);
    const ps = await login(app, 'poster', 'poster123');
    await request(app.getHttpServer())
      .post(`/api/vouchers/${vid}/post`)
      .set(auth(ps.body.access_token))
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/vouchers/${vid}`)
      .set(auth(token))
      .expect(200);
    const body = JSON.stringify(detail.body);
    expect(body).toContain(String(customerId));
  });

  it('已结账期间禁止新增凭证', async () => {
    const token = await adminToken(app);
    const period = '2026-05';
    // 先在该期间过账一笔收入，供结转
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const revenue = acct(accounts, '6001');
    const cfid = await getCashFlowItemId(app);
    await createAndPostVoucher(
      app,
      [
        { summary: '期间收入', accountId: cash.id, direction: 'debit', amount: '500.00', cashflowItemId: cfid },
        { summary: '期间收入', accountId: revenue.id, direction: 'credit', amount: '500.00' },
      ],
      1,
      period,
    );
    // 结转 + 结账
    await request(app.getHttpServer())
      .post(`/api/closing/profit-transfer?bookId=1&period=${period}`)
      .set(auth(token))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/closing/close?bookId=1&period=${period}`)
      .set(auth(token))
      .expect(201);
    // 已结账期间新增凭证应被拒绝
    const bk = await login(app, 'bookkeeper', 'bookkeeper123');
    await request(app.getHttpServer())
      .post('/api/vouchers')
      .set(auth(bk.body.access_token))
      .send({
        bookId: 1,
        period,
        date: `${period}-20`,
        voucherType: '记',
        entries: [
          { summary: '越权', accountId: cash.id, direction: 'debit', amount: '1.00', cashflowItemId: cfid },
          { summary: '越权', accountId: revenue.id, direction: 'credit', amount: '1.00' },
        ],
      })
      .expect(400);
  });

  it('小企业准则报表可用', async () => {
    const token = await adminToken(app);
    const uid = Date.now();
    const bookRes = await request(app.getHttpServer())
      .post('/api/books')
      .set(auth(token))
      .send({
        name: `小企业报表${uid}`,
        accountingStandard: 'small',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    const bookId = bookRes.body.id;
    const accounts = await request(app.getHttpServer())
      .get(`/api/accounts?bookId=${bookId}`)
      .set(auth(token))
      .expect(200);
    const cash = accounts.body.find((a: any) => a.code === '1001');
    const capital = accounts.body.find((a: any) => a.code === '3001');
    const bs = await request(app.getHttpServer())
      .get(`/api/reports/balance-sheet?bookId=${bookId}&period=2026-01`)
      .set(auth(token))
      .expect(200);
    expect(bs.body.standard).toBe('small');
    expect(bs.body.balanced).toBe(true);
    expect(cash).toBeDefined();
    expect(capital).toBeDefined();
  });

  it('凭证列表分页与状态筛选', async () => {
    const token = await adminToken(app);
    const res = await request(app.getHttpServer())
      .get('/api/vouchers?bookId=1&page=1&pageSize=2')
      .set(auth(token))
      .expect(200);
    expect(res.body.items.length).toBeLessThanOrEqual(2);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    const posted = await request(app.getHttpServer())
      .get('/api/vouchers?bookId=1&status=posted&page=1&pageSize=10')
      .set(auth(token))
      .expect(200);
    for (const item of posted.body.items) {
      expect(item.status).toBe('posted');
    }
  });

  it('金额精度：0.01 借贷平衡且精确存储', async () => {
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const capital = acct(accounts, '4001');
    const cfid = await getCashFlowItemId(app);
    const v = await createAndPostVoucher(
      app,
      [
        { summary: '精度', accountId: cash.id, direction: 'debit', amount: '0.01', cashflowItemId: cfid },
        { summary: '精度', accountId: capital.id, direction: 'credit', amount: '0.01' },
      ],
      1,
      '2026-08',
    );
    expect(v.status).toBe('posted');
    const detail = await request(app.getHttpServer())
      .get(`/api/vouchers/${v.id}`)
      .set(auth(await adminToken(app)))
      .expect(200);
    const amounts = detail.body.entries.map((e: any) => String(e.amount));
    expect(amounts).toContain('0.01');
  });
});
