import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
