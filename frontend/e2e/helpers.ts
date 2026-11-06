import { Page, expect } from '@playwright/test';

/**
 * 收在「系统设置」子菜单下的全局配置页面。
 * 菜单分组调整后，这些页面的入口需要先展开「系统设置」。
 */
const SETTINGS_ITEMS = ['账套管理', '会计科目', '辅助核算', '现金流量项目'];

export async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('input[placeholder="用户名"]', username);
  await page.fill('input[placeholder="密码"]', password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
  // 全局账套强制选择：登录后若未选账套，弹窗要求先选
  const modal = page.locator('.ant-modal').filter({ hasText: '请选择账套' });
  try {
    await modal.waitFor({ state: 'visible', timeout: 3000 });
    await modal.locator('.ant-select').click();
    await page.locator('.ant-select-item-option').first().click();
    await modal.getByRole('button', { name: /进入账套/ }).click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    // 已选过账套（localStorage 持久化）或非首次登录
  }
}

export async function logout(page: Page) {
  // 退出入口收在右上角用户下拉菜单里
  await page.locator('header .ant-dropdown-trigger').click();
  await page.getByRole('menuitem', { name: /退出登录/ }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function gotoMenu(page: Page, label: string) {
  const menu = page.getByRole('menu');
  if (SETTINGS_ITEMS.includes(label) && !(await menu.getByText(label).isVisible())) {
    await menu.getByText('系统设置').click();
    await expect(menu.getByText(label)).toBeVisible();
  }
  await menu.getByText(label).click();
}

/**
 * 录入一张借贷平衡的示例凭证并保存。
 *
 * 依赖的关键交互：
 * - 科目下拉支持按编码搜索，只列明细科目；
 * - 选定科目后方向按余额方向自动带出（库存现金=借 / 实收资本=贷）；
 * - 现金科目必须挂现金流量项目，否则保存会被后端拒绝。
 */
export async function createBalancedVoucher(page: Page, summary = '多角色测试') {
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('凭证录入')).toBeVisible();

  const rows = dialog.locator('tbody tr[data-row-key]');
  const row0 = rows.nth(0);
  const row1 = rows.nth(1);

  const pickOption = async (text: string) => {
    await page
      .locator('.ant-select-item-option')
      .filter({ hasText: text })
      .first()
      .click();
  };

  // 行1：库存现金（借）—— 现金科目，必须选择现金流量项目
  await row0.locator('input[placeholder="摘要"]').fill(summary);
  await row0.getByRole('combobox').first().click();
  await page.keyboard.type('1001');
  await pickOption('库存现金');
  await row0.getByRole('combobox').nth(1).click();
  await pickOption('销售商品');
  await row0.locator('input[placeholder="0.00"]').fill('100');

  // 行2：实收资本（贷）—— 方向自动带出，无需手工切换
  await row1.locator('input[placeholder="摘要"]').fill(summary);
  await row1.getByRole('combobox').first().click();
  await page.keyboard.type('4001');
  await pickOption('实收资本');
  await expect(row1.locator('.ant-segmented-item-selected')).toHaveText('贷');
  await row1.locator('input[placeholder="0.00"]').fill('100');

  await expect(dialog.getByText('借贷平衡')).toBeVisible();
  await dialog.getByRole('button', { name: /保存凭证/ }).click();
  await expect(dialog.getByText('凭证录入')).toBeHidden();
}
