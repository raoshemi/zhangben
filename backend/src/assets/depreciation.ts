import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

/**
 * 直线法月折旧额 = 原值 × (1 - 残值率) / 使用月数，四舍五入到分。
 * 金额一律使用 Decimal 计算，返回字符串（两位小数）。
 */
export function calculateMonthlyDepreciation(
  originalValue: string | number | Prisma.Decimal,
  residualRate: string | number | Prisma.Decimal,
  usefulLifeMonths: number,
): string {
  const original = new Decimal(originalValue);
  const rate = new Decimal(residualRate);
  const months = new Decimal(usefulLifeMonths);

  if (months.isZero() || months.isNegative()) {
    throw new Error('使用月数必须大于 0');
  }
  if (rate.isNegative() || rate.greaterThanOrEqualTo(1)) {
    throw new Error('残值率必须在 [0, 1) 区间内');
  }

  const depreciable = original.times(new Decimal(1).minus(rate));
  return depreciable
    .dividedBy(months)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}
