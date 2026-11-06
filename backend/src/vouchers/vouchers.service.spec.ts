import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto, VoucherEntryDto } from './dto/create-voucher.dto';

type AnyFn = (...args: any[]) => any;

function leafAccount(
  id: number,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id,
    bookId: 1,
    code: String(1000 + id),
    name: `科目${id}`,
    category: 'asset',
    balanceSide: 'debit',
    level: 1,
    parentId: null,
    isLeaf: true,
    auxFlags: [],
    isQuantity: false,
    isForeign: false,
    initialDebit: new Prisma.Decimal(0),
    initialCredit: new Prisma.Decimal(0),
    isActive: true,
    ...overrides,
  };
}

function entry(
  accountId: number,
  direction: 'debit' | 'credit',
  amount: string,
  extra: Partial<VoucherEntryDto> = {},
): VoucherEntryDto {
  return { summary: '测试摘要', accountId, direction, amount, ...extra };
}

function createMockPrisma() {
  const voucher = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  };
  const account = { findMany: jest.fn(), findUnique: jest.fn() };
  const cashFlowItem = { findMany: jest.fn() };
  const auxiliaryItem = { findMany: jest.fn() };
  const accountBalance = { findUnique: jest.fn(), upsert: jest.fn() };
  const period = { findUnique: jest.fn() };
  const voucherEntry = { deleteMany: jest.fn() };
  // 归档校验：默认返回启用中的账套，避免每个用例各自 mock
  const accountBook = {
    findUnique: jest.fn().mockResolvedValue({ isActive: true }),
  };

  const tx = {
    voucher,
    account,
    cashFlowItem,
    auxiliaryItem,
    accountBalance,
    period,
    voucherEntry,
    accountBook,
  };

  const prisma = {
    $transaction: jest.fn(async (fn: AnyFn) => fn(tx)),
    ...tx,
  };

  return { prisma, tx, voucher, account, cashFlowItem, auxiliaryItem, accountBalance, period, voucherEntry };
}

const posterUser = { id: 2, username: 'poster', role: 'poster' };
const bookkeeperUser = { id: 1, username: 'bookkeeper', role: 'bookkeeper' };

describe('VouchersService', () => {
  describe('借贷平衡校验', () => {
    it('借贷不平衡时拒绝创建', async () => {
      const { prisma, account, period, cashFlowItem, auxiliaryItem } =
        createMockPrisma();
      account.findMany.mockResolvedValue([leafAccount(1), leafAccount(2)]);
      period.findUnique.mockResolvedValue(null);
      cashFlowItem.findMany.mockResolvedValue([]);
      auxiliaryItem.findMany.mockResolvedValue([]);

      const service = new VouchersService(prisma as any);
      const dto: CreateVoucherDto = {
        bookId: 1,
        period: '2026-01',
        date: '2026-01-15',
        voucherType: '记',
        entries: [entry(1, 'debit', '100.00'), entry(2, 'credit', '50.00')],
      };

      await expect(service.create(dto, bookkeeperUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('已记账凭证保护', () => {
    it('已记账凭证禁止编辑', async () => {
      const { prisma, voucher } = createMockPrisma();
      voucher.findUnique.mockResolvedValue({
        id: 1,
        bookId: 1,
        period: '2026-01',
        voucherType: '记',
        voucherNo: 1,
        status: 'posted',
        date: new Date('2026-01-15'),
      });

      const service = new VouchersService(prisma as any);
      await expect(
        service.update(1, { date: '2026-01-16' }, bookkeeperUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('已记账凭证不可作废', async () => {
      const { prisma, voucher } = createMockPrisma();
      voucher.findUnique.mockResolvedValue({ id: 1, status: 'posted' });

      const service = new VouchersService(prisma as any);
      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('凭证号连续', () => {
    it('凭证号不连续时拒绝创建', async () => {
      const { prisma, voucher, account, period, cashFlowItem, auxiliaryItem } =
        createMockPrisma();
      voucher.aggregate.mockResolvedValue({ _max: { voucherNo: 5 } });
      account.findMany.mockResolvedValue([leafAccount(1), leafAccount(2)]);
      period.findUnique.mockResolvedValue(null);
      cashFlowItem.findMany.mockResolvedValue([]);
      auxiliaryItem.findMany.mockResolvedValue([]);
      voucher.create.mockResolvedValue({ id: 99 });

      const service = new VouchersService(prisma as any);
      const dto: CreateVoucherDto = {
        bookId: 1,
        period: '2026-01',
        date: '2026-01-15',
        voucherType: '记',
        voucherNo: 7,
        entries: [entry(1, 'debit', '100.00'), entry(2, 'credit', '100.00')],
      };

      await expect(service.create(dto, bookkeeperUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('未指定凭证号时自动分配连续号', async () => {
      const { prisma, voucher, account, period, cashFlowItem, auxiliaryItem } =
        createMockPrisma();
      voucher.aggregate.mockResolvedValue({ _max: { voucherNo: 5 } });
      account.findMany.mockResolvedValue([leafAccount(1), leafAccount(2)]);
      period.findUnique.mockResolvedValue(null);
      cashFlowItem.findMany.mockResolvedValue([]);
      auxiliaryItem.findMany.mockResolvedValue([]);
      voucher.create.mockResolvedValue({ id: 99, voucherNo: 6 });

      const service = new VouchersService(prisma as any);
      const dto: CreateVoucherDto = {
        bookId: 1,
        period: '2026-01',
        date: '2026-01-15',
        voucherType: '记',
        entries: [entry(1, 'debit', '100.00'), entry(2, 'credit', '100.00')],
      };

      await service.create(dto, bookkeeperUser);
      const createArgs = voucher.create.mock.calls[0][0];
      expect(createArgs.data.voucherNo).toBe(6);
    });
  });

  describe('红字冲销', () => {
    it('冲销生成反向凭证（借贷方向对调）', async () => {
      const { prisma, voucher, account, accountBalance } = createMockPrisma();
      voucher.findUnique.mockResolvedValue({
        id: 1,
        bookId: 1,
        period: '2026-01',
        voucherType: '记',
        voucherNo: 1,
        status: 'posted',
        date: new Date('2026-01-15'),
        entries: [
          {
            lineNo: 1,
            summary: '库存现金',
            accountId: 1,
            direction: 'debit',
            amount: new Prisma.Decimal('100'),
            cashflowItemId: null,
            auxs: [],
          },
          {
            lineNo: 2,
            summary: '主营业务收入',
            accountId: 2,
            direction: 'credit',
            amount: new Prisma.Decimal('100'),
            cashflowItemId: null,
            auxs: [],
          },
        ],
      });
      voucher.aggregate.mockResolvedValue({ _max: { voucherNo: 1 } });
      voucher.create.mockImplementation(async ({ data }: any) => ({
        id: 2,
        ...data,
        entries: data.entries.create,
      }));
      account.findUnique.mockImplementation(({ where }: any) =>
        leafAccount(where.id),
      );
      accountBalance.findUnique.mockResolvedValue(null);
      accountBalance.upsert.mockResolvedValue({});

      const service = new VouchersService(prisma as any);
      await service.reverse(1, posterUser);

      const createArgs = voucher.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('posted');
      expect(createArgs.data.voucherNo).toBe(2);
      const created = createArgs.data.entries.create;
      expect(created[0].direction).toBe('credit');
      expect(created[1].direction).toBe('debit');
      expect(created[0].amount.toString()).toBe('100');
    });
  });

  describe('余额更新', () => {
    it('记账时按期间 + 科目更新借/贷与期末余额', async () => {
      const { prisma, voucher, account, accountBalance, period } =
        createMockPrisma();
      voucher.findUnique.mockResolvedValue({
        id: 1,
        bookId: 1,
        period: '2026-01',
        voucherType: '记',
        voucherNo: 1,
        status: 'approved',
        date: new Date('2026-01-15'),
        entries: [
          {
            lineNo: 1,
            summary: 'a',
            accountId: 1,
            direction: 'debit',
            amount: new Prisma.Decimal('100'),
            cashflowItemId: null,
            auxs: [],
          },
          {
            lineNo: 2,
            summary: 'b',
            accountId: 2,
            direction: 'credit',
            amount: new Prisma.Decimal('100'),
            cashflowItemId: null,
            auxs: [],
          },
        ],
      });
      period.findUnique.mockResolvedValue(null);
      voucher.update.mockResolvedValue({ id: 1, status: 'posted' });
      account.findUnique.mockImplementation(({ where }: any) =>
        leafAccount(where.id),
      );
      accountBalance.findUnique.mockResolvedValue(null);
      accountBalance.upsert.mockResolvedValue({});

      const service = new VouchersService(prisma as any);
      await service.post(1, posterUser);

      expect(accountBalance.upsert).toHaveBeenCalledTimes(2);
      const calls = accountBalance.upsert.mock.calls.map((c) => c[0]);
      const acc1 = calls.find(
        (c) => c.where.bookId_period_accountId.accountId === 1,
      );
      const acc2 = calls.find(
        (c) => c.where.bookId_period_accountId.accountId === 2,
      );

      expect(acc1.update.debit.toString()).toBe('100');
      expect(acc1.update.finalDebit.toString()).toBe('100');
      expect(acc1.update.finalCredit.toString()).toBe('0');
      expect(acc2.update.credit.toString()).toBe('100');
      expect(acc2.update.finalCredit.toString()).toBe('100');
      expect(acc2.update.finalDebit.toString()).toBe('0');
    });
  });
});
