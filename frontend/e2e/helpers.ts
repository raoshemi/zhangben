import { Page, expect } from '@playwright/test';

export async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('input[placeholder="用户名"]', username);
  await page.fill('input[placeholder="密码"]', password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: /退出/ }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function gotoMenu(page: Page, label: string) {
  await page.getByRole('menu').getByText(label).click();
}
