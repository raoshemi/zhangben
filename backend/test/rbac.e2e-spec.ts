import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  login,
  auth,
  getAccounts,
  acct,
  getCashFlowItemId,
} from './test-utils';

describe('RBAC 权限矩阵 (e2e)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};
  const roles = ['admin', 'bookkeeper', 'approver', 'poster', 'viewer'];
  const nonAdmin = ['bookkeeper', 'approver', 'poster', 'viewer'];

  beforeAll(async () => {
    app = await createTestApp();
    const creds: [string, string][] = [
      ['admin', 'admin123'],
      ['bookkeeper', 'bookkeeper123'],
      ['approver', 'approver123'],
      ['poster', 'poster123'],
      ['viewer', 'viewer123'],
    ];
    for (const [u, p] of creds) {
      const res = await login(app, u, p);
      tokens[u] = res.body.access_token;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('所有角色均可读取账套(200)', async () => {
    for (const role of roles) {
      await request(app.getHttpServer())
        .get('/api/books')
        .set(auth(tokens[role]))
        .expect(200);
    }
  });

  it('仅 admin 可创建账套，其余角色 403', async () => {
    const uid = Date.now();
    const body = {
      name: `RBAC账套${uid}`,
      accountingStandard: 'small',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };
    await request(app.getHttpServer())
      .post('/api/books')
      .set(auth(tokens.admin))
      .send(body)
      .expect(201);
    for (const role of nonAdmin) {
      await request(app.getHttpServer())
        .post('/api/books')
        .set(auth(tokens[role]))
        .send({ ...body, name: `越权账套${uid}-${role}` })
        .expect(403);
    }
  });

  it('仅 admin 可创建现金流量项目，其余 403', async () => {
    const uid = Date.now();
    const body = { bookId: 1, code: `RB${uid}`, name: 'RBAC现金流', category: 'operating' };
    await request(app.getHttpServer())
      .post('/api/cashflow')
      .set(auth(tokens.admin))
      .send(body)
      .expect(201);
    for (const role of nonAdmin) {
      await request(app.getHttpServer())
        .post('/api/cashflow')
        .set(auth(tokens[role]))
        .send({ ...body, code: `RB${uid}-${role}` })
        .expect(403);
    }
  });

  it('仅 admin 可创建辅助核算，其余 403', async () => {
    const uid = Date.now();
    const body = { bookId: 1, auxType: 'customer', code: `RA${uid}`, name: 'RBAC辅助' };
    await request(app.getHttpServer())
      .post('/api/auxiliary')
      .set(auth(tokens.admin))
      .send(body)
      .expect(201);
    for (const role of nonAdmin) {
      await request(app.getHttpServer())
        .post('/api/auxiliary')
        .set(auth(tokens[role]))
        .send({ ...body, code: `RA${uid}-${role}` })
        .expect(403);
    }
  });

  it('凭证审核：仅 approver/admin 可审核，其余 403', async () => {
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const capital = acct(accounts, '4001');
    const cfid = await getCashFlowItemId(app);
    // bookkeeper 制单 + 提交
    const createRes = await request(app.getHttpServer())
      .post('/api/vouchers')
      .set(auth(tokens.bookkeeper))
      .send({
        bookId: 1,
        period: '2026-09',
        date: '2026-09-15',
        voucherType: '记',
        entries: [
          { summary: 'RBAC审核', accountId: cash.id, direction: 'debit', amount: '100.00', cashflowItemId: cfid },
          { summary: 'RBAC审核', accountId: capital.id, direction: 'credit', amount: '100.00' },
        ],
      })
      .expect(201);
    const vid = createRes.body.id;
    await request(app.getHttpServer())
      .post(`/api/vouchers/${vid}/submit`)
      .set(auth(tokens.bookkeeper))
      .expect(201);
    // 非审核角色 403
    for (const role of ['bookkeeper', 'poster', 'viewer']) {
      await request(app.getHttpServer())
        .post(`/api/vouchers/${vid}/approve`)
        .set(auth(tokens[role]))
        .expect(403);
    }
    // approver 成功审核
    await request(app.getHttpServer())
      .post(`/api/vouchers/${vid}/approve`)
      .set(auth(tokens.approver))
      .expect(201);
  });

  it('凭证记账：仅 poster/admin 可记账，其余 403', async () => {
    const accounts = await getAccounts(app);
    const cash = acct(accounts, '1001');
    const capital = acct(accounts, '4001');
    const cfid = await getCashFlowItemId(app);
    const createRes = await request(app.getHttpServer())
      .post('/api/vouchers')
      .set(auth(tokens.bookkeeper))
      .send({
        bookId: 1,
        period: '2026-10',
        date: '2026-10-15',
        voucherType: '记',
        entries: [
          { summary: 'RBAC记账', accountId: cash.id, direction: 'debit', amount: '200.00', cashflowItemId: cfid },
          { summary: 'RBAC记账', accountId: capital.id, direction: 'credit', amount: '200.00' },
        ],
      })
      .expect(201);
    const vid = createRes.body.id;
    await request(app.getHttpServer())
      .post(`/api/vouchers/${vid}/submit`)
      .set(auth(tokens.bookkeeper))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/vouchers/${vid}/approve`)
      .set(auth(tokens.approver))
      .expect(201);
    // 非记账角色 403
    for (const role of ['bookkeeper', 'approver', 'viewer']) {
      await request(app.getHttpServer())
        .post(`/api/vouchers/${vid}/post`)
        .set(auth(tokens[role]))
        .expect(403);
    }
    // poster 成功记账
    await request(app.getHttpServer())
      .post(`/api/vouchers/${vid}/post`)
      .set(auth(tokens.poster))
      .expect(201);
  });

  it('viewer 可读报表，不能创建账套', async () => {
    await request(app.getHttpServer())
      .get('/api/reports/balance-sheet?bookId=1&period=2026-01')
      .set(auth(tokens.viewer))
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/books')
      .set(auth(tokens.viewer))
      .send({ name: 'x', accountingStandard: 'small', startDate: '2026-01-01', endDate: '2026-12-31' })
      .expect(403);
  });
});
