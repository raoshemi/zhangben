import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { CreateVoucherDto, VoucherEntryDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { QueryVoucherDto } from './dto/query-voucher.dto';

type Tx = Prisma.TransactionClient;

const ZERO = () => new Prisma.Decimal(0);

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 查询
  // ============================================================

  async findAll(query: QueryVoucherDto) {
    const { bookId, period, status, keyword } = query;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.VoucherWhereInput = { bookId };
    if (period) {
      const start = query.startPeriod ?? period;
      where.period = start !== period ? { gte: start, lte: period } : period;
    }
    if (status) where.status = status;
    if (keyword) {
      const numeric = Number(keyword);
      where.OR = [
        { entries: { some: { summary: { contains: keyword, mode: 'insensitive' } } } },
        ...(Number.isInteger(numeric) && numeric > 0
          ? [{ voucherNo: numeric }]
          : []),
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.voucher.count({ where }),
      this.prisma.voucher.findMany({
        where,
        orderBy: [
          { period: 'desc' },
          { voucherType: 'asc' },
          { voucherNo: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          entries: {
            include: { account: true },
            orderBy: { lineNo: 'asc' },
          },
          creator: { select: { id: true, username: true, displayName: true } },
        },
      }),
    ]);

    return { total, page, pageSize, items };
  }

  async findOne(id: number) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            account: true,
            cashflowItem: true,
            auxs: { include: { auxiliaryItem: true } },
          },
          orderBy: { lineNo: 'asc' },
        },
        creator: { select: { id: true, username: true, displayName: true } },
        reviewer: { select: { id: true, username: true, displayName: true } },
        poster: { select: { id: true, username: true, displayName: true } },
      },
    });
    if (!voucher) {
      throw new NotFoundException('凭证不存在');
    }
    return voucher;
  }

  // ============================================================
  // 创建
  // ============================================================

  async create(dto: CreateVoucherDto, user: AuthUser) {
    const date = this.toDate(dto.date);
    this.assertPeriodMatches(dto.period, date);

    return this.prisma.$transaction(async (tx) => {
      await this.assertPeriodOpen(tx, dto.bookId, dto.period);
      await this.validateAndBalance(tx, dto.bookId, dto.entries);

      const nextNo = await this.nextVoucherNo(
        tx,
        dto.bookId,
        dto.period,
        dto.voucherType,
      );
      if (dto.voucherNo != null && dto.voucherNo !== nextNo) {
        throw new BadRequestException(`凭证号不连续，当前应为 ${nextNo}`);
      }

      return tx.voucher.create({
        data: {
          bookId: dto.bookId,
          period: dto.period,
          date,
          voucherType: dto.voucherType,
          voucherNo: nextNo,
          attachmentCount: dto.attachmentCount ?? 0,
          status: 'draft',
          source: 'manual',
          creatorId: user.id,
          entries: {
            create: dto.entries.map((e, i) => this.entryCreateData(e, i + 1)),
          },
        },
        include: { entries: { include: { auxs: true } } },
      });
    });
  }

  // ============================================================
  // 编辑
  // ============================================================

  async update(id: number, dto: UpdateVoucherDto, _user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.findUnique({ where: { id } });
      if (!voucher) throw new NotFoundException('凭证不存在');
      if (voucher.status !== 'draft') {
        throw new BadRequestException(
          '仅草稿状态的凭证可编辑；已提交的请先作废后重新录入',
        );
      }
      await this.assertPeriodOpen(tx, voucher.bookId, voucher.period);

      const date = dto.date ? this.toDate(dto.date) : voucher.date;
      if (dto.date) this.assertPeriodMatches(voucher.period, date);

      const voucherType = dto.voucherType ?? voucher.voucherType;
      if (voucherType !== voucher.voucherType) {
        const conflict = await tx.voucher.findUnique({
          where: {
            bookId_period_voucherType_voucherNo: {
              bookId: voucher.bookId,
              period: voucher.period,
              voucherType,
              voucherNo: voucher.voucherNo,
            },
          },
        });
        if (conflict) {
          throw new BadRequestException('凭证字变更后与现有凭证号冲突');
        }
      }

      if (dto.entries) {
        await this.validateAndBalance(tx, voucher.bookId, dto.entries);
      }

      return tx.voucher.update({
        where: { id },
        data: {
          ...(dto.date ? { date } : {}),
          ...(dto.voucherType ? { voucherType } : {}),
          ...(dto.attachmentCount != null
            ? { attachmentCount: dto.attachmentCount }
            : {}),
          ...(dto.entries
            ? {
                entries: {
                  deleteMany: {},
                  create: dto.entries.map((e, i) =>
                    this.entryCreateData(e, i + 1),
                  ),
                },
              }
            : {}),
        },
        include: { entries: { include: { auxs: true } } },
      });
    });
  }

  // ============================================================
  // 状态机
  // ============================================================

  async submit(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.findUnique({
        where: { id },
        include: { entries: true },
      });
      if (!voucher) throw new NotFoundException('凭证不存在');
      if (voucher.status !== 'draft') {
        throw new BadRequestException('仅草稿状态可提交');
      }
      await this.assertPeriodOpen(tx, voucher.bookId, voucher.period);

      // 提交前复验借贷平衡与叶子科目
      await this.validateAndBalance(
        tx,
        voucher.bookId,
        voucher.entries.map((e) => this.storedEntryToDto(e)),
      );

      return tx.voucher.update({
        where: { id },
        data: { status: 'submitted' },
      });
    });
  }

  async approve(id: number, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.findUnique({ where: { id } });
      if (!voucher) throw new NotFoundException('凭证不存在');
      if (voucher.status !== 'submitted') {
        throw new BadRequestException('仅已提交状态可审核');
      }
      if (voucher.creatorId === user.id) {
        throw new BadRequestException('制单人与审核人不能为同一人');
      }
      return tx.voucher.update({
        where: { id },
        data: { status: 'approved', reviewerId: user.id },
      });
    });
  }

  async post(id: number, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.findUnique({
        where: { id },
        include: { entries: true },
      });
      if (!voucher) throw new NotFoundException('凭证不存在');
      if (voucher.status !== 'approved') {
        // 单人模式（requireApproval=false）：草稿/已提交可直接记账，跳过审核
        const book = await tx.accountBook.findUnique({
          where: { id: voucher.bookId },
        });
        const directOk =
          book != null &&
          !book.requireApproval &&
          (voucher.status === 'draft' || voucher.status === 'submitted');
        if (!directOk) {
          throw new BadRequestException('仅已审核状态可记账');
        }
      }
      await this.assertPeriodOpen(tx, voucher.bookId, voucher.period);

      await this.applyBalances(tx, voucher.bookId, voucher.period, voucher.entries);

      return tx.voucher.update({
        where: { id },
        data: { status: 'posted', posterId: user.id, postedAt: new Date() },
      });
    });
  }

  // 红字冲销：生成反向凭证（借贷方向对调、金额不变），并物化更新余额。
  async reverse(id: number, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.voucher.findUnique({
        where: { id },
        include: { entries: { include: { auxs: true } } },
      });
      if (!original) throw new NotFoundException('凭证不存在');
      if (original.status !== 'posted') {
        throw new BadRequestException('仅已记账凭证可冲销');
      }
      await this.assertPeriodOpen(tx, original.bookId, original.period);

      const nextNo = await this.nextVoucherNo(
        tx,
        original.bookId,
        original.period,
        original.voucherType,
      );

      const reversal = await tx.voucher.create({
        data: {
          bookId: original.bookId,
          period: original.period,
          date: original.date,
          voucherType: original.voucherType,
          voucherNo: nextNo,
          attachmentCount: 0,
          status: 'posted',
          source: 'manual',
          creatorId: user.id,
          posterId: user.id,
          postedAt: new Date(),
          entries: {
            create: original.entries.map((e) => ({
              lineNo: e.lineNo,
              summary: `冲销:${e.summary}`,
              accountId: e.accountId,
              direction: e.direction === 'debit' ? 'credit' : 'debit',
              amount: e.amount,
              cashflowItemId: e.cashflowItemId,
              auxs: {
                create: e.auxs.map((a) => ({
                  auxType: a.auxType,
                  auxiliaryItemId: a.auxiliaryItemId,
                })),
              },
            })),
          },
        },
        include: { entries: true },
      });

      await this.applyBalances(tx, original.bookId, original.period, reversal.entries);

      return reversal;
    });
  }

  // 作废：草稿直接删除，其余（未记账）置 voided；已记账必须走红字冲销。
  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.findUnique({ where: { id } });
      if (!voucher) throw new NotFoundException('凭证不存在');
      if (voucher.status === 'posted') {
        throw new BadRequestException('已记账凭证不可作废，请使用红字冲销');
      }
      if (voucher.status === 'voided') {
        throw new BadRequestException('凭证已作废');
      }
      if (voucher.status === 'draft') {
        await tx.voucher.delete({ where: { id } });
        return { id, deleted: true };
      }
      await tx.voucher.update({ where: { id }, data: { status: 'voided' } });
      return { id, voided: true };
    });
  }

  // ============================================================
  // 内部工具
  // ============================================================

  private entryCreateData(e: VoucherEntryDto, lineNo: number) {
    return {
      lineNo,
      summary: e.summary,
      accountId: e.accountId,
      direction: e.direction,
      amount: new Prisma.Decimal(e.amount),
      cashflowItemId: e.cashflowItemId,
      auxs: {
        create: (e.auxs ?? []).map((a) => ({
          auxType: a.auxType,
          auxiliaryItemId: a.auxiliaryItemId,
        })),
      },
    };
  }

  private storedEntryToDto(e: {
    summary: string;
    accountId: number;
    direction: string;
    amount: Prisma.Decimal;
    cashflowItemId: number | null;
  }): VoucherEntryDto {
    return {
      summary: e.summary,
      accountId: e.accountId,
      direction: e.direction as 'debit' | 'credit',
      amount: e.amount.toString(),
      cashflowItemId: e.cashflowItemId ?? undefined,
    };
  }

  // 校验叶子科目、现金/银行现金流量项目、辅助核算，并强制借贷平衡。
  private async validateAndBalance(
    tx: Tx,
    bookId: number,
    entries: VoucherEntryDto[],
  ): Promise<{ totalDebit: Prisma.Decimal; totalCredit: Prisma.Decimal }> {
    if (!entries || entries.length < 2) {
      throw new BadRequestException('凭证至少需要两行分录');
    }

    const accountIds = [...new Set(entries.map((e) => e.accountId))];
    const accounts = await tx.account.findMany({
      where: { id: { in: accountIds }, bookId },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const cfIds = [
      ...new Set(
        entries
          .map((e) => e.cashflowItemId)
          .filter((v): v is number => v != null),
      ),
    ];
    const cfItems = cfIds.length
      ? await tx.cashFlowItem.findMany({ where: { id: { in: cfIds }, bookId } })
      : [];
    const cfMap = new Map(cfItems.map((c) => [c.id, c]));

    const auxIds = [
      ...new Set(
        entries.flatMap((e) => (e.auxs ?? []).map((a) => a.auxiliaryItemId)),
      ),
    ];
    const auxItems = auxIds.length
      ? await tx.auxiliaryItem.findMany({
          where: { id: { in: auxIds }, bookId },
        })
      : [];
    const auxMap = new Map(auxItems.map((a) => [a.id, a]));

    let totalDebit = ZERO();
    let totalCredit = ZERO();

    for (const e of entries) {
      if (!e.summary || !e.summary.trim()) {
        throw new BadRequestException('分录摘要不能为空');
      }
      const account = accountMap.get(e.accountId);
      if (!account) {
        throw new BadRequestException(`科目 ${e.accountId} 不存在或不属于该账套`);
      }
      if (!account.isLeaf) {
        throw new BadRequestException(
          `科目 ${account.code} ${account.name} 不是明细科目，不能作为分录科目`,
        );
      }

      const amount = new Prisma.Decimal(e.amount);
      if (!amount.isFinite() || amount.lte(0)) {
        throw new BadRequestException('金额必须为大于 0 的数字');
      }

      const auxFlags: string[] = Array.isArray(account.auxFlags)
        ? (account.auxFlags as string[])
        : [];
      if (auxFlags.includes('cashflow')) {
        if (!e.cashflowItemId) {
          throw new BadRequestException(
            `现金/银行科目 ${account.name} 必须挂现金流量项目`,
          );
        }
        if (!cfMap.has(e.cashflowItemId)) {
          throw new BadRequestException('现金流量项目不存在或不属于该账套');
        }
      } else if (e.cashflowItemId) {
        throw new BadRequestException(
          `科目 ${account.name} 非现金/银行科目，不能挂现金流量项目`,
        );
      }

      for (const a of e.auxs ?? []) {
        if (!auxFlags.includes(a.auxType)) {
          throw new BadRequestException(
            `科目 ${account.name} 未启用 ${a.auxType} 辅助核算`,
          );
        }
        if (!auxMap.has(a.auxiliaryItemId)) {
          throw new BadRequestException('辅助核算项不存在或不属于该账套');
        }
      }

      if (e.direction === 'debit') totalDebit = totalDebit.add(amount);
      else if (e.direction === 'credit') totalCredit = totalCredit.add(amount);
    }

    if (!totalDebit.eq(totalCredit)) {
      throw new BadRequestException('借贷不平衡：借方合计与贷方合计不相等');
    }
    if (totalDebit.eq(0)) {
      throw new BadRequestException('凭证借贷合计不能为 0');
    }
    return { totalDebit, totalCredit };
  }

  // 物化更新科目余额：按期间 + 科目累计借/贷，并计算期末方向余额。
  private async applyBalances(
    tx: Tx,
    bookId: number,
    period: string,
    entries: { accountId: number; direction: string; amount: Prisma.Decimal }[],
  ) {
    const agg = new Map<
      number,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const e of entries) {
      const cur = agg.get(e.accountId) ?? { debit: ZERO(), credit: ZERO() };
      if (e.direction === 'debit') cur.debit = cur.debit.add(e.amount);
      else cur.credit = cur.credit.add(e.amount);
      agg.set(e.accountId, cur);
    }

    for (const [accountId, sums] of agg) {
      const account = await tx.account.findUnique({ where: { id: accountId } });
      const existing = await tx.accountBalance.findUnique({
        where: { bookId_period_accountId: { bookId, period, accountId } },
      });
      const initialDebit = existing?.initialDebit ?? account?.initialDebit ?? ZERO();
      const initialCredit =
        existing?.initialCredit ?? account?.initialCredit ?? ZERO();
      const debit = (existing?.debit ?? ZERO()).add(sums.debit);
      const credit = (existing?.credit ?? ZERO()).add(sums.credit);

      const net = initialDebit.add(debit).sub(initialCredit).sub(credit);
      const finalDebit = net.gte(0) ? net : ZERO();
      const finalCredit = net.lt(0) ? net.neg() : ZERO();

      await tx.accountBalance.upsert({
        where: { bookId_period_accountId: { bookId, period, accountId } },
        create: {
          bookId,
          period,
          accountId,
          initialDebit,
          initialCredit,
          debit,
          credit,
          finalDebit,
          finalCredit,
        },
        update: { debit, credit, finalDebit, finalCredit },
      });
    }
  }

  private async nextVoucherNo(
    tx: Tx,
    bookId: number,
    period: string,
    voucherType: string,
  ): Promise<number> {
    const agg = await tx.voucher.aggregate({
      where: { bookId, period, voucherType },
      _max: { voucherNo: true },
    });
    return (agg._max.voucherNo ?? 0) + 1;
  }

  private async assertPeriodOpen(tx: Tx, bookId: number, period: string) {
    // 归档账套禁止任何记账操作（查询不受影响）
    const book = await tx.accountBook.findUnique({
      where: { id: bookId },
      select: { isActive: true },
    });
    if (!book?.isActive) {
      throw new BadRequestException('账套已归档，禁止新增或修改凭证');
    }
    const p = await tx.period.findUnique({
      where: { bookId_period: { bookId, period } },
    });
    if (p && p.status === 'closed') {
      throw new BadRequestException('该会计期间已结账，禁止新增或修改凭证');
    }
  }

  private toDate(s: string): Date {
    return new Date(`${s}T00:00:00.000Z`);
  }

  private assertPeriodMatches(period: string, date: Date) {
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const p = `${date.getUTCFullYear()}-${m}`;
    if (p !== period) {
      throw new BadRequestException('凭证日期与会计期间不一致');
    }
  }
}
