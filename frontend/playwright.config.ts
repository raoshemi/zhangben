import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  // 账套状态是全局业务状态：并行跑时"归档用例临时建账套"会让其它用例读到 2 个账套，
  // 导致自动选中失效。串行执行保证用例之间的账套视图稳定。
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
  },
});
