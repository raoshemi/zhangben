import { test, expect } from '@playwright/test';
import { login, gotoMenu, createBalancedVoucher } from './helpers';

test.describe('凭证录入 UI E2E', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await gotoMenu(page, '凭证管理');
    await page.getByRole('button', { name: /新增凭证/ }).click();
    await expect(page.getByText('凭证录入')).toBeVisible();
  });

  test('凭证录入表单渲染（摘要/金额/添加分录/保存）', async ({ page }) => {
    await expect(page.locator('input[placeholder="摘要"]').first()).toBeVisible();
    await expect(page.locator('input[placeholder="0.00"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /添加分录/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /保存凭证/ })).toBeVisible();
  });

  test('添加分录增加一行', async ({ page }) => {
    const before = await page.locator('input[placeholder="摘要"]').count();
    await page.getByRole('button', { name: /添加分录/ }).click();
    const after = await page.locator('input[placeholder="摘要"]').count();
    expect(after).toBe(before + 1);
  });

  test('填写金额后借方合计实时更新，并提示借贷差额', async ({ page }) => {
    const amountInputs = page.locator('input[placeholder="0.00"]');
    await amountInputs.nth(0).fill('100');
    await amountInputs.nth(1).fill('200');
    await expect(page.getByText(/借方合计：300\.00/)).toBeVisible();
    await expect(page.getByText(/借贷不平衡（差额 300\.00）/)).toBeVisible();
  });

  test('科目按编码搜索选中后自动带出方向与摘要', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    const row = dialog.locator('tbody tr[data-row-key]').first();
    await row.getByRole('combobox').first().click();
    await page.keyboard.type('4001');
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').first().click();
    // 摘要按科目名称预填，方向按余额方向（贷）带出
    await expect(row.locator('input[placeholder="摘要"]')).toHaveValue('实收资本');
    await expect(row.locator('.ant-segmented-item-selected')).toHaveText('贷');
  });

  test('完整录入一张借贷平衡凭证并保存', async ({ page }) => {
    await createBalancedVoucher(page, '收到投资款');
    // 保存后抽屉关闭，凭证进入列表
    await expect(page.getByText('凭证录入')).toBeHidden();
  });
});
