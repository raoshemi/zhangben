import { test, expect } from '@playwright/test';
import { login, gotoMenu, createBalancedVoucher } from './helpers';

/**
 * 默认账套为单人模式（requireApproval=false）：制单后草稿可直接记账，跳过提交/审核。
 * 多人模式（requireApproval=true）的提交→审核→记账由后端 e2e（vouchers.e2e-spec）覆盖。
 */
test.describe('凭证单人记账 E2E', () => {
  test('bookkeeper 制单后直接记账', async ({ page }) => {
    await login(page, 'bookkeeper', 'bookkeeper123');
    await gotoMenu(page, '凭证管理');
    await page.getByRole('button', { name: /新增凭证/ }).click();
    await createBalancedVoucher(page, '单人记账测试');

    // 单人模式：草稿行显示「记账」，一键入账
    await page.getByRole('button', { name: /^记\s*账$/ }).first().click();
    await expect(page.getByText('已记账').first()).toBeVisible();
  });
});
