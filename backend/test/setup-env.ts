process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://zhangben:zhangben@localhost:5433/zhangben_test?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
