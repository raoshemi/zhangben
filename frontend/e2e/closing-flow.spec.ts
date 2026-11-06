import { test, expect } from '@playwright/test';
import { login, gotoMenu } from './helpers';

test.describe('期末处理页面 E2E', () => {
  test('展示期间列表与损益结转/结账/反结账操作按钮', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await gotoMenu(page, '期末处理');

    await expect(
      page.getByRole('columnheader', { name: '会计期间' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '损益结转' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^结\s*账$/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '反结账' }).first()).toBeVisible();
  });
});
