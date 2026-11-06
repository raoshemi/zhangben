import { test, expect } from '@playwright/test';
import { login, gotoMenu } from './helpers';

test.describe('回归验证', () => {
  test('报表页用「起止期间」且是区间选择器', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await gotoMenu(page, '财务报表');
    await expect(page.getByText('起止期间')).toBeVisible();
    // RangePicker 渲染两个输入框
    const inputs = page.locator('.ant-picker-range input');
    expect(await inputs.count()).toBe(2);
  });

  test('头部账套切换：弹二次确认并真正切换', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    const headerSelect = page.locator('header .ant-select').first();
    await expect(headerSelect).toBeVisible();
    const before = (await headerSelect.innerText()).trim();

    await headerSelect.click();
    const options = page.locator(
      '.ant-select-dropdown:visible .ant-select-item-option',
    );
    const optionCount = await options.count();
    if (optionCount < 2) {
      test.skip(true, '仅一个账套，无法测试切换');
      return;
    }
    // 选一个与当前不同的
    let targetIdx = 0;
    for (let i = 0; i < optionCount; i++) {
      const t = (await options.nth(i).innerText()).trim();
      if (t && !t.includes(before)) {
        targetIdx = i;
        break;
      }
    }
    await options.nth(targetIdx).click();

    // 应弹出二次确认
    const modal = page.locator('.ant-modal').filter({ hasText: '切换账套' });
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.getByRole('button', { name: /切\s*换/ }).click();
    await expect(modal).toBeHidden({ timeout: 5000 });

    // 头部显示应变为新账套
    await expect(headerSelect).not.toHaveText(before, { timeout: 5000 });
  });

  test('各页面不再有「选择账套」入口', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    for (const menu of ['凭证管理', '账簿查询', '期末处理']) {
      await gotoMenu(page, menu);
      await expect(page.locator('main').getByText('选择账套')).toHaveCount(0);
    }
  });

  test('报表批量打印一页输出三张表', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await page.goto(
      '/print/report?bookId=1&period=2026-10&startPeriod=2026-01&endPeriod=2026-10&type=all',
    );
    await expect(page.getByText('资 产 负 债 表')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('利 润 表')).toBeVisible();
    await expect(page.getByText('现 金 流 量 表')).toBeVisible();
    expect(await page.locator('.sheet').count()).toBe(3);
  });

  test('凭证打印页内容不横向溢出', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await gotoMenu(page, '凭证管理');
    const [printPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('button', { name: /^打\s*印$/ }).first().click(),
    ]);
    await printPage.waitForLoadState('networkidle');
    const overflow = await printPage.evaluate(() => {
      const sheet = document.querySelector('.sheet') as HTMLElement | null;
      if (!sheet) return -1;
      return sheet.scrollWidth - sheet.clientWidth;
    });
    expect(overflow).toBeGreaterThanOrEqual(0);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('日期面板月份为中文（老会计看得懂）', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await gotoMenu(page, '财务报表');
    await page.locator('.ant-picker-range').click();
    // 月份格应显示「1月」「2月」而不是 Jan/Feb
    await expect(page.getByText('1月', { exact: true }).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('12月', { exact: true }).first()).toBeVisible();
  });

  test('账簿查询用起止期间（两个输入框）', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await gotoMenu(page, '账簿查询');
    await expect(page.getByText('起止期间').first()).toBeVisible();
    expect(await page.locator('.ant-picker-range input').count()).toBe(2);
  });

  test('凭证管理用起止期间筛选', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await gotoMenu(page, '凭证管理');
    expect(await page.locator('.ant-picker-range input').count()).toBe(2);
  });
});
