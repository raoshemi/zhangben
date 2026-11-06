import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('报表 A4 打印', () => {
  test('资产负债表打印页', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await page.goto('/print/report?bookId=1&period=2026-01&type=balance');
    await expect(page.getByText('资 产 负 债 表')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText('资产总计')).toBeVisible();
    await page.screenshot({ path: 'test-results/print-balance.png', fullPage: true });
  });

  test('利润表打印页', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await page.goto('/print/report?bookId=1&period=2026-01&type=income');
    await expect(page.getByText('利 润 表')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await page.screenshot({ path: 'test-results/print-income.png', fullPage: true });
  });
});
