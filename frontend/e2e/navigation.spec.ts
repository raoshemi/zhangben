import { test, expect } from '@playwright/test';

test.describe('页面导航 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="用户名"]', 'admin');
    await page.fill('input[placeholder="密码"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
  });

  test('可导航到账套管理与凭证管理', async ({ page }) => {
    await page.getByRole('menu').getByText('账套管理').click();
    await expect(page.getByRole('button', { name: /新建账套/ })).toBeVisible();
    await page.getByRole('menu').getByText('凭证管理').click();
    await expect(page.getByRole('button', { name: /新增凭证/ })).toBeVisible();
  });

  test('可导航到财务报表', async ({ page }) => {
    await page.getByRole('menu').getByText('财务报表').click();
    await expect(page.getByText('资产负债表')).toBeVisible();
  });
});
