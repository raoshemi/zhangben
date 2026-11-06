import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeTrialBalance,
  dec,
  decStr,
  Decimalish,
  netOf,
  recomputeFinal,
} from '../common/ledger.util';

const zero = () => dec(0);

const lastDayOfPeriod = (period: string): Date => {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, last));
};

interface AccountLike {
  id: number;
  code: string;
  name: string;
  category: string;
  balanceSide: string;
  initialDebit?: Decimalish;
  initialCredit?: Decimalish;
}

interface BalanceLike {
  initialDebit?: Decimalish;
  initialCredit?: Decimalish;
  debit?: Decimalish;
  credit?: Decimalish;
}

@Injectable()
export class ClosingService {
  constructor(private readonly prisma: PrismaService) {}

  /** 与 vouchers.applyBalances 一致的科目净额（借为正）：initial + debit - credit */
  private netOfAccount(account: AccountLike, balance?: BalanceLike | null): Prisma.Decimal {
    return netOf(
      balance?.initialDebit ?? account.initialDebit ?? 0,
      balance?.initialCredit ?? account.initialCredit ?? 0,
      balance?.debit ?? 0,
      balance?.credit ?? 0,
    );
  }

  /** 期末损益结转：损益类科目余额转「本年利润」，生成一张 source=closing 的已记账凭证 */
  async profitTransfer(bookId: number, period: string, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const periodRow = await tx.period.findUnique({
        where: { bookId_period: { bookId, period } },
      });
      if (!periodRow) throw new NotFoundException('会计期间不存在');
      if (periodRow.status === 'closed')
        throw new BadRequestException('期间已结账，禁止操作');

      const existing = await tx.voucher.findFirst({
        where: { bookId, period, source: 'closing' },
      });
      if (existing) throw new BadRequestException('本期已执行损益结转');

      const profitAccount = await tx.account.findFirst({
        where: { bookId, code: { in: ['4103', '3103'] } },
      });
      if (!profitAccount) throw new BadRequestException('未找到「本年利润」科目');

      const pnlAccounts = await tx.account.findMany({
        where: { bookId, category: 'pnl' },
      });
      const accountMap = new Map<number, AccountLike>(
        pnlAccounts.map((a) => [a.id, a as AccountLike]),
      );
      const balances = await tx.accountBalance.findMany({
        where: { bookId, period, accountId: { in: pnlAccounts.map((a) => a.id) } },
      });
      const balMap = new Map(balances.map((b) => [b.accountId, b]));

      // 收入（贷方余额）与费用（借方余额）归集
      const incomeLines: { accountId: number; amount: Prisma.Decimal }[] = [];
      const expenseLines: { accountId: number; amount: Prisma.Decimal }[] = [];
      let totalIncome = zero();
      let totalExpense = zero();

      for (const a of pnlAccounts) {
        const net = this.netOfAccount(a as AccountLike, balMap.get(a.id));
        if (a.balanceSide === 'credit') {
          // 贷方余额 = 收入
          if (net.lt(0)) {
            const amt = net.neg();
            incomeLines.push({ accountId: a.id, amount: amt });
            totalIncome = totalIncome.plus(amt);
          }
        } else {
          // 借方余额 = 费用
          if (net.gt(0)) {
            expenseLines.push({ accountId: a.id, amount: net });
            totalExpense = totalExpense.plus(net);
          }
        }
      }

      if (incomeLines.length === 0 && expenseLines.length === 0) {
        throw new BadRequestException('本期无损益余额需结转');
      }

      const netProfit = totalIncome.minus(totalExpense);

      // 凭证分录：借收入、贷费用、本年利润取净额
      let lineNo = 1;
      const entryCreate: {
        lineNo: number;
        summary: string;
        accountId: number;
        direction: string;
        amount: Prisma.Decimal;
      }[] = [];
      for (const l of incomeLines) {
        entryCreate.push({
          lineNo: lineNo++,
          summary: '期末结转损益',
          accountId: l.accountId,
          direction: 'debit',
          amount: l.amount,
        });
      }
      if (netProfit.lt(0)) {
        entryCreate.push({
          lineNo: lineNo++,
          summary: '期末结转损益',
          accountId: profitAccount.id,
          direction: 'debit',
          amount: netProfit.neg(),
        });
      }
      for (const l of expenseLines) {
        entryCreate.push({
          lineNo: lineNo++,
          summary: '期末结转损益',
          accountId: l.accountId,
          direction: 'credit',
          amount: l.amount,
        });
      }
      if (netProfit.gt(0)) {
        entryCreate.push({
          lineNo: lineNo++,
          summary: '期末结转损益',
          accountId: profitAccount.id,
          direction: 'credit',
          amount: netProfit,
        });
      }

      const last = await tx.voucher.findFirst({
        where: { bookId, period, voucherType: '转' },
        orderBy: { voucherNo: 'desc' },
      });
      const voucherNo = (last?.voucherNo ?? 0) + 1;

      const voucher = await tx.voucher.create({
        data: {
          bookId,
          period,
          date: lastDayOfPeriod(period),
          voucherType: '转',
          voucherNo,
          status: 'posted',
          source: 'closing',
          creatorId: userId,
          posterId: userId,
          postedAt: new Date(),
          entries: { create: entryCreate },
        },
        include: { entries: true },
      });

      // 更新 AccountBalance：损益科目归零、本年利润入账
      const affected = new Map<
        number,
        { extraDebit: Prisma.Decimal; extraCredit: Prisma.Decimal }
      >();
      for (const l of incomeLines) {
        const e = affected.get(l.accountId) ?? { extraDebit: zero(), extraCredit: zero() };
        e.extraDebit = e.extraDebit.plus(l.amount);
        affected.set(l.accountId, e);
      }
      for (const l of expenseLines) {
        const e = affected.get(l.accountId) ?? { extraDebit: zero(), extraCredit: zero() };
        e.extraCredit = e.extraCredit.plus(l.amount);
        affected.set(l.accountId, e);
      }
      const pe = affected.get(profitAccount.id) ?? {
        extraDebit: zero(),
        extraCredit: zero(),
      };
      if (netProfit.lt(0)) pe.extraDebit = pe.extraDebit.plus(netProfit.neg());
      if (netProfit.gt(0)) pe.extraCredit = pe.extraCredit.plus(netProfit);
      affected.set(profitAccount.id, pe);

      const profitBalance = await tx.accountBalance.findUnique({
        where: {
          bookId_period_accountId: {
            bookId,
            period,
            accountId: profitAccount.id,
          },
        },
      });

      for (const [accountId, patch] of affected) {
        const account =
          accountId === profitAccount.id
            ? (profitAccount as AccountLike)
            : accountMap.get(accountId);
        const base =
          accountId === profitAccount.id ? profitBalance : balMap.get(accountId);
        const initD = dec(base?.initialDebit ?? account?.initialDebit ?? 0);
        const initC = dec(base?.initialCredit ?? account?.initialCredit ?? 0);
        const debit = dec(base?.debit ?? 0).plus(patch.extraDebit);
        const credit = dec(base?.credit ?? 0).plus(patch.extraCredit);
        const final = recomputeFinal(initD, initC, debit, credit);
        await tx.accountBalance.upsert({
          where: { bookId_period_accountId: { bookId, period, accountId } },
          create: {
            bookId,
            period,
            accountId,
            initialDebit: initD,
            initialCredit: initC,
            debit,
            credit,
            finalDebit: final.finalDebit,
            finalCredit: final.finalCredit,
          },
          update: {
            debit,
            credit,
            finalDebit: final.finalDebit,
            finalCredit: final.finalCredit,
          },
        });
      }

      return {
        voucher: {
          id: voucher.id,
          voucherType: voucher.voucherType,
          voucherNo: voucher.voucherNo,
          source: voucher.source,
          status: voucher.status,
        },
        totalIncome: decStr(totalIncome),
        totalExpense: decStr(totalExpense),
        netProfit: decStr(netProfit),
        entryCount: voucher.entries.length,
      };
    });
  }

  /** 结账：校验已结转 + 试算平衡后锁定期间 */
  async close(bookId: number, period: string, userId: number) {
    const periodRow = await this.prisma.period.findUnique({
      where: { bookId_period: { bookId, period } },
    });
    if (!periodRow) throw new NotFoundException('会计期间不存在');
    if (periodRow.status === 'closed')
      throw new BadRequestException('期间已结账');

    const pnlAccounts = await this.prisma.account.findMany({
      where: { bookId, category: 'pnl' },
    });
    const pnlBalances = await this.prisma.accountBalance.findMany({
      where: { bookId, period, accountId: { in: pnlAccounts.map((a) => a.id) } },
    });
    const balMap = new Map(pnlBalances.map((b) => [b.accountId, b]));
    for (const a of pnlAccounts) {
      const net = this.netOfAccount(a as AccountLike, balMap.get(a.id));
      if (!net.isZero())
        throw new BadRequestException(
          `损益科目 ${a.code} ${a.name} 尚未结转，请先执行损益结转`,
        );
    }

    const leafAccounts = await this.prisma.account.findMany({
      where: { bookId, isLeaf: true },
      select: { id: true },
    });
    const allBalances = await this.prisma.accountBalance.findMany({
      where: { bookId, period, accountId: { in: leafAccounts.map((a) => a.id) } },
    });
    const trialBalance = computeTrialBalance(allBalances);
    if (!trialBalance.balanced)
      throw new BadRequestException('试算不平衡，无法结账');

    await this.prisma.period.update({
      where: { bookId_period: { bookId, period } },
      data: { status: 'closed', closedById: userId, closedAt: new Date() },
    });

    return { bookId, period, status: 'closed', trialBalance };
  }

  /** 反结账：仅当后续无已结账期间 */
  async reopen(bookId: number, period: string) {
    const periodRow = await this.prisma.period.findUnique({
      where: { bookId_period: { bookId, period } },
    });
    if (!periodRow) throw new NotFoundException('会计期间不存在');
    if (periodRow.status !== 'closed')
      throw new BadRequestException('期间未结账，无需反结账');

    const laterClosed = await this.prisma.period.findFirst({
      where: { bookId, period: { gt: period }, status: 'closed' },
    });
    if (laterClosed)
      throw new BadRequestException('存在已结账的后续期间，禁止反结账');

    await this.prisma.period.update({
      where: { bookId_period: { bookId, period } },
      data: { status: 'open', closedById: null, closedAt: null },
    });

    return { bookId, period, status: 'open' };
  }

  /** 期间列表（含结账状态，供前端） */
  async periods(bookId: number) {
    const periods = await this.prisma.period.findMany({
      where: { bookId },
      orderBy: { period: 'asc' },
    });
    return {
      rows: periods.map((p) => ({
        bookId: p.bookId,
        period: p.period,
        status: p.status,
        isYearEnd: p.isYearEnd,
        closedAt: p.closedAt,
      })),
    };
  }
}
