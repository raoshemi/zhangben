import { test, expect } from '@playwright/test';
import { login, gotoMenu } from './helpers';

test.describe('A4 打印 E2E', () => {
  test('凭证打印页展示标准记账凭证表格', async ({ page, context }) => {
    await login(page, 'admin', 'admin123');
    await gotoMenu(page, '凭证管理');

    const [printPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: /打\s*印/ }).first().click(),
    ]);
    await printPage.waitForLoadState('networkidle');

    await expect(printPage.getByText('记 账 凭 证')).toBeVisible();
    await expect(printPage.locator('table')).toBeVisible();
    await expect(printPage.getByText('合计')).toBeVisible();
    await expect(printPage.getByText(/制单人/)).toBeVisible();
    await printPage.screenshot({ path: 'test-results/print-voucher.png', fullPage: true });
  });

  test('账簿查询页有打印按钮', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await gotoMenu(page, '账簿查询');
    await expect(page.getByRole('button', { name: /打\s*印/ })).toBeVisible();
  });
});
