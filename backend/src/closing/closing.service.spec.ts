import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClosingService } from './closing.service';
import { PrismaService } from '../prisma/prisma.service';

const D = (v: number | string) => new Prisma.Decimal(v);

const profitAccount = {
  id: 99,
  code: '4103',
  name: '本年利润',
  category: 'equity',
  balanceSide: 'credit',
};

const pnlAccounts = [
  { id: 10, code: '6001', name: '主营业务收入', category: 'pnl', balanceSide: 'credit' },
  { id: 11, code: '660201', name: '办公费', category: 'pnl', balanceSide: 'debit' },
];

// 结转前：收入 5000（贷方），费用 3000（借方）
const prePnlBalances = [
  { bookId: 1, period: '2026-01', accountId: 10, initialDebit: D(0), initialCredit: D(0), debit: D(0), credit: D(5000), finalDebit: D(0), finalCredit: D(5000) },
  { bookId: 1, period: '2026-01', accountId: 11, initialDebit: D(0), initialCredit: D(0), debit: D(3000), credit: D(0), finalDebit: D(3000), finalCredit: D(0) },
];

// 结转后：损益科目 final 均为 0
const postPnlBalances = [
  { bookId: 1, period: '2026-01', accountId: 10, initialDebit: D(0), initialCredit: D(0), debit: D(5000), credit: D(5000), finalDebit: D(0), finalCredit: D(0) },
  { bookId: 1, period: '2026-01', accountId: 11, initialDebit: D(0), initialCredit: D(0), debit: D(3000), credit: D(3000), finalDebit: D(0), finalCredit: D(0) },
];

const leafAccounts = [{ id: 1 }, { id: 2 }, { id: 10 }, { id: 11 }];

const balancedAllBalances = [
  { bookId: 1, period: '2026-01', accountId: 1, initialDebit: D(1000), initialCredit: D(0), debit: D(0), credit: D(0), finalDebit: D(1000), finalCredit: D(0) },
  { bookId: 1, period: '2026-01', accountId: 2, initialDebit: D(0), initialCredit: D(1000), debit: D(0), credit: D(0), finalDebit: D(0), finalCredit: D(1000) },
  ...postPnlBalances,
];

function makePrisma() {
  const mock: any = {
    $transaction: jest.fn(async (cb: any) => cb(mock)),
    period: {
      findUnique: jest.fn().mockResolvedValue({ bookId: 1, period: '2026-01', status: 'open', isYearEnd: false }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ bookId: 1, period: '2026-01', status: 'closed' }),
    },
    account: {
      findFirst: jest.fn().mockResolvedValue(profitAccount),
      findMany: jest.fn().mockResolvedValue(pnlAccounts),
    },
    accountBalance: {
      findMany: jest.fn().mockResolvedValue(prePnlBalances),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    voucher: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 999, voucherType: '转', voucherNo: 4, source: 'closing', status: 'posted', entries: [{}, {}, {}] }),
    },
  };
  return mock;
}

describe('ClosingService', () => {
  let service: ClosingService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [ClosingService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ClosingService);
  });

  it('profitTransfer：生成 source=closing 凭证且借贷平衡，结转后损益归零', async () => {
    let createdData: any;
    prisma.voucher.findFirst.mockImplementation(async (args: any) =>
      args.where.source === 'closing' ? null : { voucherNo: 3 },
    );
    prisma.voucher.create.mockImplementation(async (args: any) => {
      createdData = args.data;
      return {
        id: 999,
        voucherType: args.data.voucherType,
        voucherNo: args.data.voucherNo,
        source: args.data.source,
        status: args.data.status,
        entries: args.data.entries.create,
      };
    });
    const upsertCalls: any[] = [];
    prisma.accountBalance.upsert.mockImplementation(async (args: any) => {
      upsertCalls.push(args);
      return {};
    });

    const result = await service.profitTransfer(1, '2026-01', 1);

    expect(result.voucher.source).toBe('closing');
    expect(result.totalIncome).toBe('5000.00');
    expect(result.totalExpense).toBe('3000.00');
    expect(result.netProfit).toBe('2000.00');

    // 借贷平衡
    const entries: any[] = createdData.entries.create;
    let debitSum = D(0);
    let creditSum = D(0);
    for (const e of entries) {
      if (e.direction === 'debit') debitSum = debitSum.plus(e.amount);
      else creditSum = creditSum.plus(e.amount);
    }
    expect(debitSum.eq(creditSum)).toBe(true);

    // 结转后损益科目 final 归零
    const incomeUpsert = upsertCalls.find(
      (c) => c.where.bookId_period_accountId.accountId === 10,
    );
    expect(incomeUpsert.update.finalDebit.toString()).toBe('0');
    expect(incomeUpsert.update.finalCredit.toString()).toBe('0');

    // 本年利润入账净利 2000（贷方）
    const profitUpsert = upsertCalls.find(
      (c) => c.where.bookId_period_accountId.accountId === 99,
    );
    expect(profitUpsert.update.credit.toString()).toBe('2000');
  });

  it('close：校验已结转 + 试算平衡后置为 closed', async () => {
    prisma.accountBalance.findMany.mockImplementation(async (args: any) =>
      args.where.accountId.in.length === 2 ? postPnlBalances : balancedAllBalances,
    );
    prisma.account.findMany.mockImplementation(async (args: any) =>
      args.where.category === 'pnl' ? pnlAccounts : leafAccounts,
    );

    const result = await service.close(1, '2026-01', 1);

    expect(result.status).toBe('closed');
    expect(prisma.period.update).toHaveBeenCalled();
    expect(prisma.period.update.mock.calls[0][0].data.status).toBe('closed');
  });

  it('close：损益未结转时拒绝结账', async () => {
    // 收入科目仍有贷方余额（未结转）
    prisma.accountBalance.findMany.mockResolvedValue(prePnlBalances);
    await expect(service.close(1, '2026-01', 1)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('已结账期间锁定：结账期间禁止再次结转/结账', async () => {
    prisma.period.findUnique.mockResolvedValue({ bookId: 1, period: '2026-01', status: 'closed' });

    await expect(service.profitTransfer(1, '2026-01', 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.close(1, '2026-01', 1)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reopen：仅当后续无已结账期间才允许反结账', async () => {
    prisma.period.findUnique.mockResolvedValue({ bookId: 1, period: '2026-01', status: 'closed' });
    prisma.period.findFirst.mockResolvedValue(null); // 无后续已结账期间

    const result = await service.reopen(1, '2026-01');
    expect(result.status).toBe('open');

    // 存在后续已结账期间 → 拒绝
    prisma.period.findFirst.mockResolvedValue({ id: 2, bookId: 1, period: '2026-02', status: 'closed' });
    await expect(service.reopen(1, '2026-01')).rejects.toThrow(
      BadRequestException,
    );
  });
});
