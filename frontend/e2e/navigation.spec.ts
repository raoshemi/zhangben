import { test, expect } from '@playwright/test';
import { login, gotoMenu } from './helpers';

test.describe('页面导航 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin', 'admin123');
  });

  test('可导航到账套管理与凭证管理', async ({ page }) => {
    await gotoMenu(page, '账套管理');
    await expect(page.getByRole('button', { name: /新建账套/ })).toBeVisible();
    await gotoMenu(page, '凭证管理');
    await expect(page.getByRole('button', { name: /新增凭证/ })).toBeVisible();
  });

  test('可导航到财务报表', async ({ page }) => {
    await gotoMenu(page, '财务报表');
    await expect(page.getByText('资产负债表')).toBeVisible();
  });

  test('全局配置收在系统设置分组内', async ({ page }) => {
    const menu = page.getByRole('menu');
    await menu.getByText('系统设置').click();
    await expect(menu.getByText('会计科目')).toBeVisible();
    await expect(menu.getByText('辅助核算')).toBeVisible();
    await expect(menu.getByText('现金流量项目')).toBeVisible();
  });
});
