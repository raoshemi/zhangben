import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountingStandard,
  BalanceRecord,
  computeBalanceSheet,
  computeCashFlowStatement,
  computeIncomeStatement,
  monetaryFunds,
} from './report-calculator';

const Decimal = Prisma.Decimal;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async balanceSheet(bookId: number, period: string) {
    const standard = await this.ensureBook(bookId);
    const balances = await this.resolveBalances(bookId, period);
    const report = computeBalanceSheet(standard, balances);
    return { bookId, period, ...report };
  }

  async incomeStatement(bookId: number, period: string) {
    const standard = await this.ensureBook(bookId);
    const balances = await this.resolveBalances(bookId, period);
    const report = computeIncomeStatement(standard, balances);
    return { bookId, period, ...report };
  }

  async cashFlow(bookId: number, period: string) {
    const standard = await this.ensureBook(bookId);
    const balances = await this.resolveBalances(bookId, period);
    const funds = monetaryFunds(balances);

    const items = await this.prisma.cashFlowItem.findMany({
      where: { bookId },
      orderBy: { code: 'asc' },
    });
    const entries = await this.prisma.voucherEntry.findMany({
      where: {
        cashflowItemId: { not: null },
        voucher: { bookId, period, status: 'posted' },
      },
      select: { cashflowItemId: true, direction: true, amount: true },
    });

    const report = computeCashFlowStatement(
      standard,
      items,
      entries.map((e) => ({
        cashflowItemId: e.cashflowItemId as number,
        direction: e.direction,
        amount: e.amount,
      })),
      funds.beginning,
      funds.ending,
    );
    return { bookId, period, ...report };
  }

  private async ensureBook(bookId: number): Promise<AccountingStandard> {
    const book = await this.prisma.accountBook.findUnique({
      where: { id: bookId },
      select: { accountingStandard: true },
    });
    if (!book) {
      throw new NotFoundException(`账套 ${bookId} 不存在`);
    }
    return book.accountingStandard as AccountingStandard;
  }

  /**
   * 解析某期间的科目余额：
   * 1. 优先使用物化快照 AccountBalance；
   * 2. 若无快照，则按「已记账凭证 + 科目期初」实时汇总。
   */
  private async resolveBalances(
    bookId: number,
    period: string,
  ): Promise<BalanceRecord[]> {
    const accounts = await this.prisma.account.findMany({
      where: { bookId },
      orderBy: { code: 'asc' },
    });

    const snapshots = await this.prisma.accountBalance.findMany({
      where: { bookId, period },
    });
    if (snapshots.length > 0) {
      const snapMap = new Map(snapshots.map((s) => [s.accountId, s]));
      return accounts.map((a) => {
        const s = snapMap.get(a.id);
        return {
          code: a.code,
          name: a.name,
          category: a.category,
          balanceSide: a.balanceSide,
          initialDebit: s?.initialDebit ?? a.initialDebit,
          initialCredit: s?.initialCredit ?? a.initialCredit,
          debit: s?.debit ?? new Decimal(0),
          credit: s?.credit ?? new Decimal(0),
          finalDebit: s?.finalDebit ?? a.initialDebit,
          finalCredit: s?.finalCredit ?? a.initialCredit,
        };
      });
    }

    // 实时汇总（无快照时）：期初来自科目表，发生额来自已记账凭证
    const entries = await this.prisma.voucherEntry.findMany({
      where: {
        voucher: { bookId, period: { lte: period }, status: 'posted' },
      },
      select: {
        accountId: true,
        direction: true,
        amount: true,
        voucher: { select: { period: true } },
      },
    });

    const cumDebit = new Map<number, Prisma.Decimal>();
    const cumCredit = new Map<number, Prisma.Decimal>();
    const periodDebit = new Map<number, Prisma.Decimal>();
    const periodCredit = new Map<number, Prisma.Decimal>();

    for (const e of entries) {
      const debit = e.direction === 'debit' ? e.amount : new Decimal(0);
      const credit = e.direction === 'credit' ? e.amount : new Decimal(0);
      cumDebit.set(e.accountId, (cumDebit.get(e.accountId) ?? new Decimal(0)).plus(debit));
      cumCredit.set(e.accountId, (cumCredit.get(e.accountId) ?? new Decimal(0)).plus(credit));
      if (e.voucher.period === period) {
        periodDebit.set(e.accountId, (periodDebit.get(e.accountId) ?? new Decimal(0)).plus(debit));
        periodCredit.set(e.accountId, (periodCredit.get(e.accountId) ?? new Decimal(0)).plus(credit));
      }
    }

    return accounts.map((a) => {
      const finalDebit = a.initialDebit.plus(cumDebit.get(a.id) ?? new Decimal(0));
      const finalCredit = a.initialCredit.plus(cumCredit.get(a.id) ?? new Decimal(0));
      const pd = periodDebit.get(a.id) ?? new Decimal(0);
      const pc = periodCredit.get(a.id) ?? new Decimal(0);
      return {
        code: a.code,
        name: a.name,
        category: a.category,
        balanceSide: a.balanceSide,
        initialDebit: finalDebit.minus(pd),
        initialCredit: finalCredit.minus(pc),
        debit: pd,
        credit: pc,
        finalDebit,
        finalCredit,
      };
    });
  }
}
