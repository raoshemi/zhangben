import { test, expect } from '@playwright/test';

test.describe('周会计记账系统 浏览器 E2E', () => {
  test('登录页渲染用户名与密码输入框', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[placeholder="用户名"]')).toBeVisible();
    await expect(page.locator('input[placeholder="密码"]')).toBeVisible();
  });

  test('admin 登录成功进入仪表盘', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="用户名"]', 'admin');
    await page.fill('input[placeholder="密码"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
  });
});
