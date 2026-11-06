import { describe, it, expect } from '@jest/globals';
import { calculateMonthlyDepreciation } from './depreciation';

describe('calculateMonthlyDepreciation（直线法）', () => {
  it('公式：原值 × (1 - 残值率) / 使用月数', () => {
    // 120000 × (1 - 0.05) / 60 = 1900.00
    expect(calculateMonthlyDepreciation('120000', '0.05', 60)).toBe('1900.00');
  });

  it('四舍五入到分（HALF_UP）', () => {
    // 10000 × 0.95 / 36 = 263.888… → 263.89
    expect(calculateMonthlyDepreciation('10000', '0.05', 36)).toBe('263.89');
    // 1000 × 0.95 / 3 = 316.666… → 316.67
    expect(calculateMonthlyDepreciation('1000', '0.05', 3)).toBe('316.67');
  });

  it('残值率为 0 时等于原值 / 使用月数', () => {
    expect(calculateMonthlyDepreciation('6000', '0', 12)).toBe('500.00');
  });

  it('使用月数非正数时抛错', () => {
    expect(() => calculateMonthlyDepreciation('1000', '0.05', 0)).toThrow();
  });

  it('残值率非法时抛错', () => {
    expect(() => calculateMonthlyDepreciation('1000', '1', 12)).toThrow();
  });
});
