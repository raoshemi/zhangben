import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { calculateMonthlyDepreciation } from './depreciation';

const Decimal = Prisma.Decimal;

const assetInclude = {
  depreciationAccount: { select: { id: true, code: true, name: true } },
  accumulatedDepreciationAccount: { select: { id: true, code: true, name: true } },
  depreciations: {
    select: { id: true, period: true, amount: true },
    orderBy: { period: 'asc' as const },
  },
} satisfies Prisma.AssetInclude;

type AssetWithRelations = Prisma.AssetGetPayload<{ include: typeof assetInclude }>;

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAssetDto) {
    await this.assertAccounts(
      dto.bookId,
      dto.depreciationAccountId,
      dto.accumulatedDepreciationAccountId,
    );
    const asset = await this.prisma.asset.create({
      data: {
        bookId: dto.bookId,
        code: dto.code,
        name: dto.name,
        category: dto.category,
        originalValue: dto.originalValue,
        residualRate: dto.residualRate ?? '0.05',
        usefulLife: dto.usefulLife,
        depreciationMethod: dto.depreciationMethod ?? 'straight_line',
        startDate: new Date(dto.startDate),
        depreciationAccountId: dto.depreciationAccountId,
        accumulatedDepreciationAccountId: dto.accumulatedDepreciationAccountId,
        isActive: dto.isActive ?? true,
      },
      include: assetInclude,
    });
    return this.serialize(asset);
  }

  async findAll(bookId?: number) {
    const assets = await this.prisma.asset.findMany({
      where: bookId ? { bookId } : undefined,
      include: assetInclude,
      orderBy: { id: 'asc' },
    });
    return assets.map((a) => this.serialize(a));
  }

  async findOne(id: number) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: assetInclude,
    });
    if (!asset) {
      throw new NotFoundException(`固定资产 ${id} 不存在`);
    }
    return this.serialize(asset);
  }

  async update(id: number, dto: UpdateAssetDto) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`固定资产 ${id} 不存在`);
    }
    const depreciationAccountId =
      dto.depreciationAccountId ?? asset.depreciationAccountId;
    const accumulatedDepreciationAccountId =
      dto.accumulatedDepreciationAccountId ?? asset.accumulatedDepreciationAccountId;
    await this.assertAccounts(
      asset.bookId,
      depreciationAccountId,
      accumulatedDepreciationAccountId,
    );

    const data: Prisma.AssetUncheckedUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.originalValue !== undefined) data.originalValue = dto.originalValue;
    if (dto.residualRate !== undefined) data.residualRate = dto.residualRate;
    if (dto.usefulLife !== undefined) data.usefulLife = dto.usefulLife;
    if (dto.depreciationMethod !== undefined)
      data.depreciationMethod = dto.depreciationMethod;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.depreciationAccountId !== undefined)
      data.depreciationAccountId = dto.depreciationAccountId;
    if (dto.accumulatedDepreciationAccountId !== undefined)
      data.accumulatedDepreciationAccountId = dto.accumulatedDepreciationAccountId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.asset.update({
      where: { id },
      data,
      include: assetInclude,
    });
    return this.serialize(updated);
  }

  async remove(id: number) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`固定资产 ${id} 不存在`);
    }
    // 软删除，保留折旧历史
    await this.prisma.asset.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, deleted: true };
  }

  /**
   * 计提折旧：计算月折旧额、生成折旧凭证（借 折旧费 / 贷 累计折旧），
   * 并写入 AssetDepreciation。同一期间只能计提一次。
   */
  async depreciate(id: number, period: string, userId?: number) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`固定资产 ${id} 不存在`);
    }
    if (!asset.isActive) {
      throw new BadRequestException('固定资产已停用，无法计提折旧');
    }
    const existing = await this.prisma.assetDepreciation.findUnique({
      where: { assetId_period: { assetId: id, period } },
    });
    if (existing) {
      throw new ConflictException(`期间 ${period} 已计提折旧`);
    }

    const amount = calculateMonthlyDepreciation(
      asset.originalValue,
      asset.residualRate,
      asset.usefulLife,
    );

    const voucherNo = await this.nextVoucherNo(asset.bookId, period);
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7)); // 1..12
    const lastDay = new Date(Date.UTC(year, month, 0)); // 当月最后一天
    const summary = `计提折旧-${asset.name}`;

    const depreciation = await this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          bookId: asset.bookId,
          period,
          date: lastDay,
          voucherType: '记',
          voucherNo,
          attachmentCount: 0,
          status: 'posted',
          source: 'depreciation',
          creatorId: userId ?? null,
          posterId: userId ?? null,
          postedAt: new Date(),
        },
      });
      await tx.voucherEntry.createMany({
        data: [
          {
            voucherId: voucher.id,
            lineNo: 1,
            summary,
            accountId: asset.depreciationAccountId,
            direction: 'debit',
            amount,
          },
          {
            voucherId: voucher.id,
            lineNo: 2,
            summary,
            accountId: asset.accumulatedDepreciationAccountId,
            direction: 'credit',
            amount,
          },
        ],
      });
      return tx.assetDepreciation.create({
        data: { assetId: id, period, amount, voucherId: voucher.id },
      });
    });

    return {
      id: depreciation.id,
      assetId: depreciation.assetId,
      period: depreciation.period,
      amount: depreciation.amount.toString(),
      voucherId: depreciation.voucherId,
    };
  }

  private async nextVoucherNo(bookId: number, period: string): Promise<number> {
    const agg = await this.prisma.voucher.aggregate({
      where: { bookId, period, voucherType: '记' },
      _max: { voucherNo: true },
    });
    return (agg._max.voucherNo ?? 0) + 1;
  }

  private async assertAccounts(bookId: number, ...accountIds: number[]) {
    for (const accountId of accountIds) {
      const account = await this.prisma.account.findFirst({
        where: { id: accountId, bookId },
        select: { id: true },
      });
      if (!account) {
        throw new BadRequestException(
          `科目 ${accountId} 不存在或不属于账套 ${bookId}`,
        );
      }
    }
  }

  private serialize(a: AssetWithRelations) {
    const accumulatedDepreciation = a.depreciations.reduce(
      (sum, d) => sum.plus(d.amount),
      new Decimal(0),
    );
    const originalValue = new Decimal(a.originalValue);
    return {
      id: a.id,
      bookId: a.bookId,
      code: a.code,
      name: a.name,
      category: a.category,
      originalValue: originalValue.toFixed(2),
      residualRate: a.residualRate.toString(),
      usefulLife: a.usefulLife,
      depreciationMethod: a.depreciationMethod,
      startDate: a.startDate.toISOString().slice(0, 10),
      depreciationAccountId: a.depreciationAccountId,
      depreciationAccount: a.depreciationAccount,
      accumulatedDepreciationAccountId: a.accumulatedDepreciationAccountId,
      accumulatedDepreciationAccount: a.accumulatedDepreciationAccount,
      isActive: a.isActive,
      accumulatedDepreciation: accumulatedDepreciation.toFixed(2),
      netValue: originalValue.minus(accumulatedDepreciation).toFixed(2),
      depreciationCount: a.depreciations.length,
    };
  }
}
