import { test, expect } from '@playwright/test';
import { login, gotoMenu, createBalancedVoucher } from './helpers';

/**
 * 单人模式（requireApproval=false）：草稿可直接记账，跳过提交/审核。
 * 单人部署的用户通常是 admin（拥有记账权限）。
 * 多人模式的提交→审核→记账由后端 e2e（rbac.e2e-spec）覆盖。
 */
test.describe('凭证单人记账 E2E', () => {
  test('制单后直接记账', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await gotoMenu(page, '凭证管理');
    await page.getByRole('button', { name: /新增凭证/ }).click();
    await createBalancedVoucher(page, '单人记账测试');

    // 注意：tbody tr 的第一个是 ant-table 的隐藏测量行，数据行要按 data-row-key 取
    const firstRow = page.locator('tbody tr[data-row-key]').first();
    await expect(firstRow).toContainText('单人记账测试', { timeout: 10000 });

    // 单人模式：草稿行显示「记账」，一键入账
    await page.getByRole('button', { name: /^记\s*账$/ }).first().click();

    // 精确断言：最新一张（第一行）已变为已记账
    await expect(firstRow).toContainText('已记账', { timeout: 10000 });
  });
});
