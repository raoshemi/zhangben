import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBookDto,
  CreateAccountDto,
  CreateAuxiliaryDto,
  UpdateBookDto,
  UpdateAccountDto,
} from './dto';
import { enterpriseAccounts, smallAccounts, SeedAccount } from '../shared/account-chart';
import { buildPeriods } from '../shared/periods';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- 账套 ----------------
  listBooks(includeArchived = false) {
    return this.prisma.accountBook.findMany({
      where: includeArchived ? {} : { isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  async getBook(id: number) {
    const book = await this.prisma.accountBook.findUnique({ where: { id } });
    if (!book) throw new NotFoundException('账套不存在');
    return book;
  }

  /** 归档：置为停用，保留全部历史数据 */
  async archiveBook(id: number) {
    const book = await this.getBook(id);
    if (!book.isActive) return book;
    const activeCount = await this.prisma.accountBook.count({
      where: { isActive: true },
    });
    if (activeCount <= 1) {
      throw new BadRequestException('至少保留一个启用中的账套，不能归档最后一个');
    }
    return this.prisma.accountBook.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** 重新启用 */
  async restoreBook(id: number) {
    await this.getBook(id);
    return this.prisma.accountBook.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /** 彻底删除账套（仅当账套内没有任何凭证时允许；有凭证请用归档） */
  async deleteBook(id: number) {
    await this.getBook(id);
    const voucherCount = await this.prisma.voucher.count({
      where: { bookId: id },
    });
    if (voucherCount > 0) {
      throw new BadRequestException(
        `该账套已有 ${voucherCount} 张凭证，不能删除；如需停用请改用「归档」`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.accountBalance.deleteMany({ where: { bookId: id } });
      await tx.asset.deleteMany({ where: { bookId: id } });
      await tx.reportTemplate.deleteMany({ where: { bookId: id } });
      await tx.period.deleteMany({ where: { bookId: id } });
      await tx.auxiliaryItem.deleteMany({ where: { bookId: id } });
      await tx.cashFlowItem.deleteMany({ where: { bookId: id } });
      await tx.account.deleteMany({ where: { bookId: id } });
      await tx.accountBook.delete({ where: { id } });
    });
    return { ok: true };
  }

  /**
   * 期初余额录入（期初建账）。
   *
   * 规则与金蝶/用友一致：
   * 1) 只能录明细科目（叶子科目）；
   * 2) Σ期初借方 = Σ期初贷方（试算平衡），否则拒绝保存；
   * 3) 一旦该账套已有「已记账」凭证，期初锁定（需先反记账/反结账）。
   */
  async saveInitialBalances(
    bookId: number,
    items: { accountId: number; initialDebit?: string; initialCredit?: string }[],
    auxItems: {
      accountId: number;
      auxType: string;
      auxItemId: number;
      debit?: string;
      credit?: string;
    }[] = [],
  ) {
    await this.getBook(bookId);

    const posted = await this.prisma.voucher.count({
      where: { bookId, status: 'posted' },
    });
    if (posted > 0) {
      throw new BadRequestException(
        `该账套已有 ${posted} 张已记账凭证，期初余额已锁定；如需修改请先反记账`,
      );
    }

    const accounts = await this.prisma.account.findMany({ where: { bookId } });
    const byId = new Map(accounts.map((a) => [a.id, a]));

    for (const it of items) {
      const account = byId.get(it.accountId);
      if (!account) {
        throw new BadRequestException(`科目 ${it.accountId} 不属于当前账套`);
      }
      if (!account.isLeaf) {
        throw new BadRequestException(
          `「${account.code} ${account.name}」不是明细科目，只能录明细科目的期初余额`,
        );
      }
    }

    // ---------- 辅助核算期初：校验 + 汇总 ----------
    const auxDefs = await this.prisma.auxiliaryItem.findMany({
      where: { bookId },
    });
    const auxDefById = new Map(auxDefs.map((a) => [a.id, a]));
    const auxSumByAccount = new Map<
      number,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    const auxRows: {
      accountId: number;
      auxType: string;
      auxItemId: number;
      debit: string;
      credit: string;
    }[] = [];
    const seen = new Set<string>();

    for (const a of auxItems) {
      const account = byId.get(a.accountId);
      if (!account || !account.isLeaf) {
        throw new BadRequestException(`科目 ${a.accountId} 不是本账套的明细科目`);
      }
      const flags = this.auxFlagsOf(account);
      // 现金流量不是余额维度，不允许按期初辅助项录入
      if (a.auxType === 'cashflow' || !flags.includes(a.auxType)) {
        throw new BadRequestException(
          `「${account.code} ${account.name}」未启用「${a.auxType}」辅助核算`,
        );
      }
      const def = auxDefById.get(a.auxItemId);
      if (!def || def.auxType !== a.auxType) {
        throw new BadRequestException(
          `辅助核算项 ${a.auxItemId} 不属于当前账套的「${a.auxType}」`,
        );
      }
      const key = `${a.accountId}|${a.auxType}|${a.auxItemId}`;
      if (seen.has(key)) {
        throw new BadRequestException(`辅助明细重复：${def.code} ${def.name}`);
      }
      seen.add(key);

      const debit = this.toAmount(a.debit, `辅助项 ${def.name} 期初借方`);
      const credit = this.toAmount(a.credit, `辅助项 ${def.name} 期初贷方`);
      const acc = auxSumByAccount.get(a.accountId) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      acc.debit = acc.debit.plus(debit);
      acc.credit = acc.credit.plus(credit);
      auxSumByAccount.set(a.accountId, acc);
      auxRows.push({
        accountId: a.accountId,
        auxType: a.auxType,
        auxItemId: a.auxItemId,
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
      });
    }

    // ---------- 全量明细科目：科目级期初 + 借贷平衡 ----------
    const submitted = new Map(items.map((i) => [i.accountId, i]));
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    const updates: {
      accountId: number;
      initialDebit: string;
      initialCredit: string;
    }[] = [];

    for (const account of accounts) {
      if (!account.isLeaf) continue;
      const it = submitted.get(account.id);
      const auxSum = auxSumByAccount.get(account.id);

      let debit: Prisma.Decimal;
      let credit: Prisma.Decimal;
      if (it) {
        debit = this.toAmount(it.initialDebit, `${account.code} 期初借方`);
        credit = this.toAmount(it.initialCredit, `${account.code} 期初贷方`);
        // 有辅助明细的科目：科目级必须等于辅助明细之和（借贷分别相等）
        if (auxSum && (!debit.equals(auxSum.debit) || !credit.equals(auxSum.credit))) {
          throw new BadRequestException(
            `「${account.code} ${account.name}」科目期初(借 ${debit.toFixed(2)} / 贷 ${credit.toFixed(
              2,
            )}) 与辅助明细合计(借 ${auxSum.debit.toFixed(2)} / 贷 ${auxSum.credit.toFixed(2)}) 不一致`,
          );
        }
      } else if (auxSum) {
        // 只传了辅助明细：科目级由辅助明细回写
        debit = auxSum.debit;
        credit = auxSum.credit;
      } else {
        debit = new Prisma.Decimal(account.initialDebit);
        credit = new Prisma.Decimal(account.initialCredit);
      }

      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
      if (it || auxSum) {
        updates.push({
          accountId: account.id,
          initialDebit: debit.toFixed(2),
          initialCredit: credit.toFixed(2),
        });
      }
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `期初余额借贷不平衡：借方合计 ${totalDebit.toFixed(2)} ≠ 贷方合计 ${totalCredit.toFixed(2)}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.account.update({
          where: { id: u.accountId },
          data: { initialDebit: u.initialDebit, initialCredit: u.initialCredit },
        });
      }
      // 辅助明细整体替换
      await tx.openingBalanceAux.deleteMany({ where: { bookId } });
      if (auxRows.length > 0) {
        await tx.openingBalanceAux.createMany({
          data: auxRows.map((r) => ({ bookId, ...r })),
        });
      }
    });

    return {
      ok: true,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      auxCount: auxRows.length,
    };
  }

  /** 读取期初辅助明细（供前端展开编辑） */
  async listInitialAux(bookId: number) {
    return this.prisma.openingBalanceAux.findMany({
      where: { bookId },
      orderBy: [{ accountId: 'asc' }, { auxType: 'asc' }, { auxItemId: 'asc' }],
    });
  }

  private auxFlagsOf(account: { auxFlags: Prisma.JsonValue }): string[] {
    const raw = account.auxFlags;
    if (Array.isArray(raw)) return raw.map((x) => String(x));
    return [];
  }

  private toAmount(value: string | undefined, label: string): Prisma.Decimal {
    if (value == null || String(value).trim() === '') return new Prisma.Decimal(0);
    const s = String(value).replace(/,/g, '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
      throw new BadRequestException(`${label}格式不正确（最多两位小数、不能为负）`);
    }
    return new Prisma.Decimal(s);
  }

  async createBook(dto: CreateBookDto) {
    const book = await this.prisma.accountBook.create({
      data: {
        name: dto.name,
        accountingStandard: dto.accountingStandard,
        baseCurrency: dto.baseCurrency ?? 'CNY',
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
    const chart =
      dto.accountingStandard === 'small' ? smallAccounts : enterpriseAccounts;
    await this.importChart(book.id, chart);
    await this.prisma.period.createMany({
      data: buildPeriods(book.id, book.startDate, book.endDate),
    });
    return book;
  }

  async updateBook(id: number, dto: UpdateBookDto) {
    await this.getBook(id);
    return this.prisma.accountBook.update({ where: { id }, data: dto });
  }

  // ---------------- 科目 ----------------
  listAccounts(bookId: number) {
    return this.prisma.account.findMany({
      where: { bookId },
      orderBy: { code: 'asc' },
    });
  }

  async createAccount(dto: CreateAccountDto) {
    const exists = await this.prisma.account.findUnique({
      where: { bookId_code: { bookId: dto.bookId, code: dto.code } },
    });
    if (exists) throw new BadRequestException('科目编码已存在');
    return this.prisma.account.create({
      data: {
        bookId: dto.bookId,
        code: dto.code,
        name: dto.name,
        category: dto.category,
        balanceSide: dto.balanceSide,
        parentId: dto.parentId ?? null,
        isLeaf: true,
        auxFlags: dto.auxFlags ?? [],
        isQuantity: dto.isQuantity ?? false,
        isForeign: dto.isForeign ?? false,
        initialDebit: dto.initialDebit ?? 0,
        initialCredit: dto.initialCredit ?? 0,
      },
    });
  }

  async updateAccount(id: number, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('科目不存在');
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  async deleteAccount(id: number) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('科目不存在');
    const entryCount = await this.prisma.voucherEntry.count({
      where: { accountId: id },
    });
    if (entryCount > 0) throw new BadRequestException('该科目已有凭证分录，不可删除');
    return this.prisma.account.delete({ where: { id } });
  }

  // ---------------- 辅助核算 ----------------
  listAuxiliary(bookId: number, auxType?: string) {
    return this.prisma.auxiliaryItem.findMany({
      where: { bookId, ...(auxType ? { auxType } : {}) },
      orderBy: [{ auxType: 'asc' }, { code: 'asc' }],
    });
  }

  async createAuxiliary(dto: CreateAuxiliaryDto) {
    return this.prisma.auxiliaryItem.create({
      data: {
        bookId: dto.bookId,
        auxType: dto.auxType,
        code: dto.code,
        name: dto.name,
      },
    });
  }

  async deleteAuxiliary(id: number) {
    return this.prisma.auxiliaryItem.delete({ where: { id } });
  }

  // ---------------- 导入科目表 ----------------
  private async importChart(
    bookId: number,
    accounts: SeedAccount[],
    parentId: number | null = null,
    level = 1,
  ) {
    for (const a of accounts) {
      const hasChildren = !!a.children && a.children.length > 0;
      const account = await this.prisma.account.create({
        data: {
          bookId,
          code: a.code,
          name: a.name,
          category: a.category,
          balanceSide: a.side,
          level,
          parentId,
          isLeaf: !hasChildren,
          auxFlags: a.aux ?? [],
        },
      });
      if (hasChildren) {
        await this.importChart(bookId, a.children!, account.id, level + 1);
      }
    }
  }
}
