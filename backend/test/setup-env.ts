process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://zhangben:zhangben@localhost:5433/zhangben_test?schema=public';
// JWT_SECRET 现在有强度校验（≥32 字符、禁止默认值），测试用固定长串
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'e2e-only-test-secret-32plus-chars-abcdef';
