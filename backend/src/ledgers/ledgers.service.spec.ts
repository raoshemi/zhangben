import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { LedgersService } from './ledgers.service';
import { PrismaService } from '../prisma/prisma.service';

const D = (v: number | string) => new Prisma.Decimal(v);

// 账套 1 的科目树：1001/4001 一级叶子，6602 一级父科目，660201 二级叶子
const accounts = [
  { id: 1, code: '1001', name: '库存现金', category: 'asset', balanceSide: 'debit', level: 1, parentId: null, isLeaf: true },
  { id: 2, code: '4001', name: '实收资本', category: 'equity', balanceSide: 'credit', level: 1, parentId: null, isLeaf: true },
  { id: 3, code: '6602', name: '管理费用', category: 'pnl', balanceSide: 'debit', level: 1, parentId: null, isLeaf: false },
  { id: 4, code: '660201', name: '办公费', category: 'pnl', balanceSide: 'debit', level: 2, parentId: 3, isLeaf: true },
];

// 平衡的期间余额：借 500 管理费用，贷 500 库存现金
const balances = [
  { bookId: 1, period: '2026-01', accountId: 1, initialDebit: D(2000), initialCredit: D(0), debit: D(0), credit: D(500), finalDebit: D(1500), finalCredit: D(0) },
  { bookId: 1, period: '2026-01', accountId: 2, initialDebit: D(0), initialCredit: D(2000), debit: D(0), credit: D(0), finalDebit: D(0), finalCredit: D(2000) },
  { bookId: 1, period: '2026-01', accountId: 4, initialDebit: D(0), initialCredit: D(0), debit: D(500), credit: D(0), finalDebit: D(500), finalCredit: D(0) },
];

const detailEntries = [
  {
    id: 100,
    voucherId: 10,
    lineNo: 1,
    summary: '报销办公费',
    accountId: 4,
    direction: 'debit',
    amount: D(500),
    voucher: { id: 10, date: new Date('2026-01-15T00:00:00.000Z'), voucherType: '记', voucherNo: 1, status: 'posted' },
  },
];

describe('LedgersService', () => {
  let service: LedgersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    prisma = {
      account: {
        findMany: jest.fn().mockResolvedValue(accounts),
        findFirst: jest
          .fn()
          .mockResolvedValue(accounts.find((a) => a.id === 4)),
      },
      accountBalance: {
        findMany: jest.fn().mockResolvedValue(balances),
        findUnique: jest.fn().mockResolvedValue(balances[2]),
      },
      voucherEntry: { findMany: jest.fn().mockResolvedValue(detailEntries) },
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [LedgersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(LedgersService);
  });

  it('试算平衡：各方向合计相等且 balanced=true', async () => {
    const result = await service.trialBalance(1, '2026-01');
    expect(result.balanced).toBe(true);
    expect(result.initialDebit).toBe('2000.00');
    expect(result.initialCredit).toBe('2000.00');
    expect(result.currentDebit).toBe('500.00');
    expect(result.currentCredit).toBe('500.00');
    expect(result.finalDebit).toBe('2000.00');
    expect(result.finalCredit).toBe('2000.00');
  });

  it('试算平衡：借贷不等时 balanced=false', async () => {
    const unbalanced = balances.map((b) =>
      b.accountId === 1 ? { ...b, initialDebit: D(2100) } : b,
    );
    (prisma.accountBalance.findMany as jest.Mock).mockResolvedValue(unbalanced);
    const result = await service.trialBalance(1, '2026-01');
    expect(result.balanced).toBe(false);
  });

  it('总账按一级科目汇总（滚动子科目）', async () => {
    const result = await service.general(1, '2026-01');
    const row6602 = result.rows.find((r) => r.code === '6602');
    expect(row6602).toBeDefined();
    expect(row6602!.currentDebit).toBe('500.00');
    expect(row6602!.currentCredit).toBe('0.00');
    expect(row6602!.finalDebit).toBe('500.00');
  });

  it('明细账发生额 = 总账该科目本期发生额', async () => {
    const detail = await service.detail(1, '2026-01', 4);
    expect(detail.currentDebit).toBe('500.00');
    expect(detail.currentCredit).toBe('0.00');

    const general = await service.general(1, '2026-01');
    const row6602 = general.rows.find((r) => r.code === '6602')!;
    expect(detail.currentDebit).toBe(row6602.currentDebit);
    expect(detail.currentCredit).toBe(row6602.currentCredit);
  });
});
