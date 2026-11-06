import { test, expect } from '@playwright/test';
import { login, gotoMenu } from './helpers';

test.describe('页面功能 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin', 'admin123');
  });

  test('账套管理：打开新建账套弹窗', async ({ page }) => {
    await gotoMenu(page, '账套管理');
    await page.getByRole('button', { name: /新建账套/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /确 定/ })).toBeVisible();
  });

  test('期末处理：页面与期末流程说明渲染', async ({ page }) => {
    await gotoMenu(page, '期末处理');
    await expect(page.getByRole('heading', { name: '期末处理' })).toBeVisible();
    await expect(page.getByText(/期末流程/)).toBeVisible();
    await expect(page.getByText(/会计期间/).first()).toBeVisible();
  });

  test('财务报表：选择账套查询后渲染数据', async ({ page }) => {
    await gotoMenu(page, '财务报表');
    await expect(page.getByText('资产负债表')).toBeVisible();
    // 选择账套
    await page.locator('.ant-select').first().click();
    await page.locator('.ant-select-item-option').first().click();
    // 查询
    await page.getByRole('button', { name: /查 询/ }).click();
    // 首行数据渲染
    await expect(page.getByText('货币资金').first()).toBeVisible({ timeout: 15000 });
  });

  test('账簿查询：总账页签渲染', async ({ page }) => {
    await gotoMenu(page, '账簿查询');
    await expect(page.getByRole('heading', { name: '账簿查询' })).toBeVisible();
    await expect(page.getByText('总账')).toBeVisible();
  });
});
