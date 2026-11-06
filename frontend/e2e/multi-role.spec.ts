import { test, expect } from '@playwright/test';
import { login, logout, gotoMenu } from './helpers';

test.describe('凭证多角色流转 E2E', () => {
  test('bookkeeper 制单提交 → approver 审核 → poster 记账', async ({ page }) => {
    // 1. bookkeeper 创建并保存凭证
    await login(page, 'bookkeeper', 'bookkeeper123');
    await gotoMenu(page, '凭证管理');
    await page.getByRole('button', { name: /新增凭证/ }).click();
    const dialog = page.getByRole('dialog');
    const summaries = dialog.locator('input[placeholder="摘要"]');
    const amounts = dialog.locator('input[placeholder="0.00"]');
    const selects = dialog.locator('.ant-select');

    await summaries.nth(0).fill('多角色测试');
    await selects.nth(1).click();
    await page.keyboard.type('库存现金');
    await page.waitForTimeout(300);
    await page.getByText('1001 库存现金').click();
    await selects.nth(3).click();
    await page.locator('.ant-select-item-option').first().click();
    await amounts.nth(0).fill('100');

    await summaries.nth(1).fill('多角色测试');
    await selects.nth(5).click();
    await page.keyboard.type('实收资本');
    await page.waitForTimeout(300);
    await page.getByText('4001 实收资本').click();
    await selects.nth(6).click();
    await page.locator('.ant-select-item-option').filter({ hasText: '贷' }).click();
    await amounts.nth(1).fill('100');

    await expect(page.getByText('借贷平衡')).toBeVisible();
    await page.getByRole('button', { name: /保存凭证/ }).click();
    await expect(page.getByText('凭证录入')).toBeHidden();

    // 提交（最新草稿在第一行）
    await page.getByRole('button', { name: /提\s*交/ }).first().click();
    await expect(page.getByText('已提交').first()).toBeVisible();

    // 2. approver 审核
    await logout(page);
    await login(page, 'approver', 'approver123');
    await gotoMenu(page, '凭证管理');
    await page.getByRole('button', { name: /审\s*核/ }).first().click();
    await expect(page.getByText('已审核').first()).toBeVisible();

    // 3. poster 记账
    await logout(page);
    await login(page, 'poster', 'poster123');
    await gotoMenu(page, '凭证管理');
    await page.getByRole('button', { name: /记\s*账/ }).first().click();
    await expect(page.getByText('已记账').first()).toBeVisible();
  });
});
