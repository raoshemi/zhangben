import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import request from 'supertest';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.listen(0);
  return app;
}

export function login(app: INestApplication, username: string, password: string) {
  return request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username, password })
    .expect(200);
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function adminToken(app: INestApplication): Promise<string> {
  const res = await login(app, 'admin', 'admin123');
  return res.body.access_token;
}

export async function getAccounts(app: INestApplication, bookId = 1) {
  const res = await request(app.getHttpServer())
    .get(`/api/accounts?bookId=${bookId}`)
    .set(auth(await adminToken(app)))
    .expect(200);
  return res.body;
}

export function acct(accounts: any[], code: string) {
  return accounts.find((a) => a.code === code);
}

export async function getCashFlowItemId(
  app: INestApplication,
  bookId = 1,
  category = 'operating',
) {
  const res = await request(app.getHttpServer())
    .get(`/api/cashflow?bookId=${bookId}`)
    .set(auth(await adminToken(app)))
    .expect(200);
  const item = res.body.find((c) => c.category === category);
  return item ? item.id : null;
}

// 完整凭证流程：bookkeeper 制单提交 → approver 审核 → poster 记账
export async function createAndPostVoucher(
  app: INestApplication,
  entries: any[],
  bookId = 1,
  period = '2026-01',
) {
  const bk = await login(app, 'bookkeeper', 'bookkeeper123');
  const bkToken = bk.body.access_token;
  const createRes = await request(app.getHttpServer())
    .post('/api/vouchers')
    .set(auth(bkToken))
    .send({
      bookId,
      period,
      date: `${period}-15`,
      voucherType: '记',
      entries,
    })
    .expect(201);
  const vid = createRes.body.id;
  await request(app.getHttpServer())
    .post(`/api/vouchers/${vid}/submit`)
    .set(auth(bkToken))
    .expect(201);
  const ap = await login(app, 'approver', 'approver123');
  await request(app.getHttpServer())
    .post(`/api/vouchers/${vid}/approve`)
    .set(auth(ap.body.access_token))
    .expect(201);
  const ps = await login(app, 'poster', 'poster123');
  const postRes = await request(app.getHttpServer())
    .post(`/api/vouchers/${vid}/post`)
    .set(auth(ps.body.access_token))
    .expect(201);
  return postRes.body;
}
