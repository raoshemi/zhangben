import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dec, decStr, netOf, computeTrialBalance } from '../common/ledger.util';

interface RollupTotals {
  initialDebit: Prisma.Decimal;
  initialCredit: Prisma.Decimal;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  finalDebit: Prisma.Decimal;
  finalCredit: Prisma.Decimal;
}

const zero = () => dec(0);

const fmtDate = (d: Date): string => d.toISOString().slice(0, 10);

@Injectable()
export class LedgersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 读取某账套某期间的叶子科目余额（AccountBalance 物化快照），并滚动到各级科目 */
  private async loadRollup(
    bookId: number,
    period: string,
  ): Promise<{ accounts: any[]; rollup: Map<number, RollupTotals> }> {
    const accounts = await this.prisma.account.findMany({
      where: { bookId },
      orderBy: { code: 'asc' },
    });
    const byId = new Map<number, any>(accounts.map((a) => [a.id, a]));

    const balances = await this.prisma.accountBalance.findMany({
      where: { bookId, period },
    });

    // 叶子余额按科目聚合
    const leafBalances = new Map<number, RollupTotals>();
    for (const b of balances) {
      const account = byId.get(b.accountId);
      if (!account || !account.isLeaf) continue;
      leafBalances.set(b.accountId, {
        initialDebit: dec(b.initialDebit),
        initialCredit: dec(b.initialCredit),
        debit: dec(b.debit),
        credit: dec(b.credit),
        finalDebit: dec(b.finalDebit),
        finalCredit: dec(b.finalCredit),
      });
    }

    // 建 children 映射
    const childrenOf = new Map<number, number[]>();
    for (const a of accounts) {
      if (a.parentId == null) continue;
      const arr = childrenOf.get(a.parentId) ?? [];
      arr.push(a.id);
      childrenOf.set(a.parentId, arr);
    }

    const rollup = new Map<number, RollupTotals>();
    const accumulate = (id: number): RollupTotals => {
      const cached = rollup.get(id);
      if (cached) return cached;
      const total: RollupTotals = {
        initialDebit: zero(),
        initialCredit: zero(),
        debit: zero(),
        credit: zero(),
        finalDebit: zero(),
        finalCredit: zero(),
      };
      const leaf = leafBalances.get(id);
      if (leaf) {
        total.initialDebit = total.initialDebit.plus(leaf.initialDebit);
        total.initialCredit = total.initialCredit.plus(leaf.initialCredit);
        total.debit = total.debit.plus(leaf.debit);
        total.credit = total.credit.plus(leaf.credit);
        total.finalDebit = total.finalDebit.plus(leaf.finalDebit);
        total.finalCredit = total.finalCredit.plus(leaf.finalCredit);
      }
      for (const childId of childrenOf.get(id) ?? []) {
        const c = accumulate(childId);
        total.initialDebit = total.initialDebit.plus(c.initialDebit);
        total.initialCredit = total.initialCredit.plus(c.initialCredit);
        total.debit = total.debit.plus(c.debit);
        total.credit = total.credit.plus(c.credit);
        total.finalDebit = total.finalDebit.plus(c.finalDebit);
        total.finalCredit = total.finalCredit.plus(c.finalCredit);
      }
      rollup.set(id, total);
      return total;
    };

    for (const a of accounts) accumulate(a.id);

    return { accounts, rollup };
  }

  private toRow(account: any, t: RollupTotals | undefined) {
    const r = t ?? {
      initialDebit: zero(),
      initialCredit: zero(),
      debit: zero(),
      credit: zero(),
      finalDebit: zero(),
      finalCredit: zero(),
    };
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      category: account.category,
      balanceSide: account.balanceSide,
      initialDebit: decStr(r.initialDebit),
      initialCredit: decStr(r.initialCredit),
      currentDebit: decStr(r.debit),
      currentCredit: decStr(r.credit),
      finalDebit: decStr(r.finalDebit),
      finalCredit: decStr(r.finalCredit),
    };
  }

  /** 总账：按一级科目汇总 */
  async general(bookId: number, period: string) {
    const { accounts, rollup } = await this.loadRollup(bookId, period);
    const rows = accounts
      .filter((a) => a.level === 1)
      .map((a) => this.toRow(a, rollup.get(a.id)));
    return { bookId, period, rows };
  }

  /** 科目余额表：列出全部科目（含父级滚动汇总） */
  async accountBalance(bookId: number, period: string) {
    const { accounts, rollup } = await this.loadRollup(bookId, period);
    const rows = accounts.map((a) => this.toRow(a, rollup.get(a.id)));
    return { bookId, period, rows };
  }

  /** 试算平衡 */
  async trialBalance(bookId: number, period: string) {
    const { accounts, rollup } = await this.loadRollup(bookId, period);
    const leaves = accounts.filter((a) => a.isLeaf);
    const balances = leaves.map((a) => {
      const t = rollup.get(a.id)!;
      return {
        initialDebit: t.initialDebit,
        initialCredit: t.initialCredit,
        debit: t.debit,
        credit: t.credit,
        finalDebit: t.finalDebit,
        finalCredit: t.finalCredit,
      };
    });
    return { bookId, period, ...computeTrialBalance(balances) };
  }

  /** 明细账：指定科目逐笔序时 + 期初/本期合计/期末 */
  async detail(bookId: number, period: string, accountId: number) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, bookId },
    });
    if (!account) throw new NotFoundException('科目不存在');

    const balance = await this.prisma.accountBalance.findUnique({
      where: { bookId_period_accountId: { bookId, period, accountId } },
    });

    const entries = await this.prisma.voucherEntry.findMany({
      where: {
        accountId,
        voucher: { bookId, period, status: 'posted' },
      },
      include: { voucher: true },
      orderBy: [
        { voucher: { date: 'asc' } },
        { voucher: { id: 'asc' } },
        { lineNo: 'asc' },
      ],
    });

    const openingNet = netOf(
      balance?.initialDebit,
      balance?.initialCredit,
      0,
      0,
    );
    let running = openingNet;
    let totalDebit = zero();
    let totalCredit = zero();

    const lines = entries.map((e) => {
      const debit = e.direction === 'debit' ? dec(e.amount) : zero();
      const credit = e.direction === 'credit' ? dec(e.amount) : zero();
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
      running = running.plus(debit).minus(credit);
      return {
        date: fmtDate(e.voucher.date),
        voucherId: e.voucherId,
        voucherType: e.voucher.voucherType,
        voucherNo: e.voucher.voucherNo,
        summary: e.summary,
        debit: decStr(debit),
        credit: decStr(credit),
        balance: decStr(running.abs()),
        balanceDirection: running.gte(zero()) ? 'debit' : 'credit',
      };
    });

    return {
      bookId,
      period,
      account: {
        accountId: account.id,
        code: account.code,
        name: account.name,
        category: account.category,
        balanceSide: account.balanceSide,
      },
      opening: {
        amount: decStr(openingNet.abs()),
        direction: openingNet.gte(zero()) ? 'debit' : 'credit',
      },
      currentDebit: decStr(totalDebit),
      currentCredit: decStr(totalCredit),
      closing: {
        amount: decStr(running.abs()),
        direction: running.gte(zero()) ? 'debit' : 'credit',
      },
      lines,
    };
  }

  /** 现金/银行日记账：逐笔、日清月结，收入(借)/支出(贷)/余额 */
  async journal(bookId: number, period: string, type: 'cash' | 'bank') {
    const code = type === 'cash' ? '1001' : '1002';
    const accounts = await this.prisma.account.findMany({
      where: { bookId, code: { startsWith: code } },
      orderBy: { code: 'asc' },
    });
    if (accounts.length === 0) throw new NotFoundException('未找到对应科目');
    const accountIds = accounts.map((a) => a.id);

    const balances = await this.prisma.accountBalance.findMany({
      where: { bookId, period, accountId: { in: accountIds } },
    });
    const openingNet = balances.reduce(
      (acc, b) => acc.plus(netOf(b.initialDebit, b.initialCredit, 0, 0)),
      zero(),
    );

    const entries = await this.prisma.voucherEntry.findMany({
      where: {
        accountId: { in: accountIds },
        voucher: { bookId, period, status: 'posted' },
      },
      include: { voucher: true },
      orderBy: [
        { voucher: { date: 'asc' } },
        { voucher: { id: 'asc' } },
        { lineNo: 'asc' },
      ],
    });

    // 对方科目：同一凭证中除本日记账科目外的其余科目
    const voucherIds = [...new Set(entries.map((e) => e.voucherId))];
    const siblingEntries = voucherIds.length
      ? await this.prisma.voucherEntry.findMany({
          where: { voucherId: { in: voucherIds } },
          include: { account: true },
        })
      : [];
    const siblingsByVoucher = new Map<number, string[]>();
    for (const se of siblingEntries) {
      if (accountIds.includes(se.accountId)) continue;
      const arr = siblingsByVoucher.get(se.voucherId) ?? [];
      if (!arr.includes(se.account.name)) arr.push(se.account.name);
      siblingsByVoucher.set(se.voucherId, arr);
    }

    let running = openingNet;
    let totalIncome = zero();
    let totalExpense = zero();

    const lines = entries.map((e) => {
      const income = e.direction === 'debit' ? dec(e.amount) : zero();
      const expense = e.direction === 'credit' ? dec(e.amount) : zero();
      totalIncome = totalIncome.plus(income);
      totalExpense = totalExpense.plus(expense);
      running = running.plus(income).minus(expense);
      return {
        date: fmtDate(e.voucher.date),
        voucherId: e.voucherId,
        voucherType: e.voucher.voucherType,
        voucherNo: e.voucher.voucherNo,
        summary: e.summary,
        oppositeAccount: (siblingsByVoucher.get(e.voucherId) ?? []).join('、'),
        income: decStr(income),
        expense: decStr(expense),
        balance: decStr(running.abs()),
        balanceDirection: running.gte(zero()) ? 'debit' : 'credit',
      };
    });

    return {
      bookId,
      period,
      type,
      account: { code, name: accounts[0].name, accounts: accounts.length },
      opening: {
        amount: decStr(openingNet.abs()),
        direction: openingNet.gte(zero()) ? 'debit' : 'credit',
      },
      summary: {
        totalIncome: decStr(totalIncome),
        totalExpense: decStr(totalExpense),
        closing: decStr(running.abs()),
        direction: running.gte(zero()) ? 'debit' : 'credit',
      },
      lines,
    };
  }

  /** 账套列表（供前端选择器使用） */
  async books() {
    const books = await this.prisma.accountBook.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true, name: true, accountingStandard: true },
    });
    return { rows: books };
  }
}
