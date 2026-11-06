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

  async incomeStatement(bookId: number, period: string, endPeriod?: string) {
    const standard = await this.ensureBook(bookId);
    const isRange = !!endPeriod && endPeriod !== period;
    const balances = isRange
      ? await this.resolveRangeActivity(bookId, period, endPeriod)
      : await this.resolveBalances(bookId, period);
    const report = computeIncomeStatement(standard, balances);
    return {
      bookId,
      period: isRange ? `${period}~${endPeriod}` : period,
      ...report,
    };
  }

  async cashFlow(bookId: number, period: string, endPeriod?: string) {
    const standard = await this.ensureBook(bookId);
    const isRange = !!endPeriod && endPeriod !== period;

    let beginning: string;
    let ending: string;
    if (isRange) {
      const startBal = await this.resolveBalances(bookId, period);
      const endBal = await this.resolveBalances(bookId, endPeriod);
      beginning = monetaryFunds(startBal).beginning;
      ending = monetaryFunds(endBal).ending;
    } else {
      const balances = await this.resolveBalances(bookId, period);
      const funds = monetaryFunds(balances);
      beginning = funds.beginning;
      ending = funds.ending;
    }

    const items = await this.prisma.cashFlowItem.findMany({
      where: { bookId },
      orderBy: { code: 'asc' },
    });
    const entries = await this.prisma.voucherEntry.findMany({
      where: {
        cashflowItemId: { not: null },
        voucher: {
          bookId,
          period: isRange ? { gte: period, lte: endPeriod } : period,
          status: 'posted',
        },
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
      beginning,
      ending,
    );
    return {
      bookId,
      period: isRange ? `${period}~${endPeriod}` : period,
      ...report,
    };
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

  /** 汇总某期间范围的科目发生额（用于利润表等「期间」报表的跨月累计） */
  private async resolveRangeActivity(
    bookId: number,
    start: string,
    end: string,
  ): Promise<BalanceRecord[]> {
    const accounts = await this.prisma.account.findMany({
      where: { bookId },
      orderBy: { code: 'asc' },
    });
    const entries = await this.prisma.voucherEntry.findMany({
      where: {
        voucher: { bookId, period: { gte: start, lte: end }, status: 'posted' },
      },
      select: { accountId: true, direction: true, amount: true },
    });
    const debit = new Map<number, Prisma.Decimal>();
    const credit = new Map<number, Prisma.Decimal>();
    for (const e of entries) {
      const d = e.direction === 'debit' ? e.amount : new Decimal(0);
      const c = e.direction === 'credit' ? e.amount : new Decimal(0);
      debit.set(e.accountId, (debit.get(e.accountId) ?? new Decimal(0)).plus(d));
      credit.set(e.accountId, (credit.get(e.accountId) ?? new Decimal(0)).plus(c));
    }
    return accounts.map((a) => ({
      code: a.code,
      name: a.name,
      category: a.category,
      balanceSide: a.balanceSide,
      initialDebit: new Decimal(0),
      initialCredit: new Decimal(0),
      debit: debit.get(a.id) ?? new Decimal(0),
      credit: credit.get(a.id) ?? new Decimal(0),
      finalDebit: new Decimal(0),
      finalCredit: new Decimal(0),
    }));
  }
}
