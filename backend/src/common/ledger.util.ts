import { Prisma } from '@prisma/client';

// 金额一律 Decimal（禁浮点）。API 输出统一为 2 位小数字符串。
export type Decimalish = Prisma.Decimal | number | string | null | undefined;

/** 任意金额输入 → Prisma.Decimal（decimal.js） */
export const dec = (v: Decimalish): Prisma.Decimal =>
  new Prisma.Decimal((v ?? 0) as Prisma.Decimal.Value);

/** Decimal → 固定 2 位小数字符串（用于 API 响应） */
export const decStr = (v: Decimalish): string => dec(v).toFixed(2);

/** 借贷方向统一化为“借为正”的净额：initD - initC + debit - credit */
export const netOf = (
  initialDebit: Decimalish,
  initialCredit: Decimalish,
  debit: Decimalish,
  credit: Decimalish,
): Prisma.Decimal =>
  dec(initialDebit).minus(dec(initialCredit)).plus(dec(debit)).minus(dec(credit));

/** 由期初/本期发生额重算期末借/贷（保证 final = initial + debit - credit 恒成立） */
export const recomputeFinal = (
  initialDebit: Decimalish,
  initialCredit: Decimalish,
  debit: Decimalish,
  credit: Decimalish,
): { finalDebit: Prisma.Decimal; finalCredit: Prisma.Decimal } => {
  const net = netOf(initialDebit, initialCredit, debit, credit);
  const zero = dec(0);
  return {
    finalDebit: net.gt(zero) ? net : zero,
    finalCredit: net.lt(zero) ? net.neg() : zero,
  };
};

/** 一条科目余额记录的最小字段集（AccountBalance / 测试 mock 通用） */
export interface BalanceLike {
  initialDebit: Decimalish;
  initialCredit: Decimalish;
  debit: Decimalish;
  credit: Decimalish;
  finalDebit: Decimalish;
  finalCredit: Decimalish;
}

export interface TrialBalanceResult {
  balanced: boolean;
  initialDebit: string;
  initialCredit: string;
  currentDebit: string;
  currentCredit: string;
  finalDebit: string;
  finalCredit: string;
}

/** 试算平衡：Σ期初借=Σ期初贷、Σ本期借=Σ本期贷、Σ期末借=Σ期末贷 */
export function computeTrialBalance(balances: BalanceLike[]): TrialBalanceResult {
  let initialDebit = dec(0);
  let initialCredit = dec(0);
  let currentDebit = dec(0);
  let currentCredit = dec(0);
  let finalDebit = dec(0);
  let finalCredit = dec(0);

  for (const b of balances) {
    initialDebit = initialDebit.plus(dec(b.initialDebit));
    initialCredit = initialCredit.plus(dec(b.initialCredit));
    currentDebit = currentDebit.plus(dec(b.debit));
    currentCredit = currentCredit.plus(dec(b.credit));
    finalDebit = finalDebit.plus(dec(b.finalDebit));
    finalCredit = finalCredit.plus(dec(b.finalCredit));
  }

  return {
    balanced:
      initialDebit.eq(initialCredit) &&
      currentDebit.eq(currentCredit) &&
      finalDebit.eq(finalCredit),
    initialDebit: decStr(initialDebit),
    initialCredit: decStr(initialCredit),
    currentDebit: decStr(currentDebit),
    currentCredit: decStr(currentCredit),
    finalDebit: decStr(finalDebit),
    finalCredit: decStr(finalCredit),
  };
}
