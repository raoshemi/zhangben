import { test, expect } from '@playwright/test';

test.describe('凭证录入 UI E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="用户名"]', 'admin');
    await page.fill('input[placeholder="密码"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
    await page.getByRole('menu').getByText('凭证管理').click();
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

  test('填写金额后借方合计实时更新', async ({ page }) => {
    const amountInputs = page.locator('input[placeholder="0.00"]');
    await amountInputs.nth(0).fill('100');
    await amountInputs.nth(1).fill('200');
    await expect(page.getByText(/借方合计：300\.00/)).toBeVisible();
  });

  test('完整录入一张借贷平衡凭证并保存', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    const summaries = dialog.locator('input[placeholder="摘要"]');
    const amounts = dialog.locator('input[placeholder="0.00"]');
    // .ant-select 索引：0=凭证字，1=行1科目，2=行1方向…5=行2科目，6=行2方向
    const selects = dialog.locator('.ant-select');

    // 行1：借 库存现金 100（现金科目需挂现金流量项目）
    await summaries.nth(0).fill('收到投资款');
    await selects.nth(1).click();
    await page.keyboard.type('库存现金');
    await page.waitForTimeout(300);
    await page.getByText('1001 库存现金').click();
    await selects.nth(3).click();
    await page.locator('.ant-select-item-option').first().click();
    await amounts.nth(0).fill('100');

    // 行2：贷 实收资本 100（方向从借改为贷）
    await summaries.nth(1).fill('收到投资款');
    await selects.nth(5).click();
    await page.keyboard.type('实收资本');
    await page.waitForTimeout(300);
    await page.getByText('4001 实收资本').click();
    await selects.nth(6).click();
    await page.locator('.ant-select-item-option').filter({ hasText: '贷' }).click();
    await amounts.nth(1).fill('100');

    await expect(page.getByText('借贷平衡')).toBeVisible();
    await page.getByRole('button', { name: /保存凭证/ }).click();
    // 保存成功后抽屉关闭，凭证进入列表
    await expect(page.getByText('凭证录入')).toBeHidden();
  });
});
