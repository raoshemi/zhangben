import { test, expect } from '@playwright/test';
import { login, logout, gotoMenu, createBalancedVoucher } from './helpers';

test.describe('凭证多角色流转 E2E', () => {
  test('bookkeeper 制单提交 → approver 审核 → poster 记账', async ({ page }) => {
    // 1. bookkeeper 创建并保存凭证
    await login(page, 'bookkeeper', 'bookkeeper123');
    await gotoMenu(page, '凭证管理');
    await page.getByRole('button', { name: /新增凭证/ }).click();
    await createBalancedVoucher(page, '多角色测试');

    // 提交（最新草稿在第一行）
    await page.getByRole('button', { name: /提\s*交/ }).first().click();
    await expect(page.getByText('已提交').first()).toBeVisible();

    // 2. approver 审核（制单人不能自审，所以换角色）
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
