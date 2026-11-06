/**
 * 启动期安全配置校验。
 *
 * 历史问题：JWT 密钥用 `process.env.JWT_SECRET ?? 'dev-secret'` 兜底，
 * 仓库里公开的默认值可被用来伪造 admin 令牌。这里改为「缺失/弱值直接拒绝启动」。
 */
const BANNED_SECRETS = [
  'dev-secret',
  'change-me-in-production',
  'test-secret',
  'secret',
  'changeme',
];

export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || BANNED_SECRETS.includes(secret)) {
    throw new Error(
      'JWT_SECRET 未配置或强度不足（必须 ≥32 字符的随机值，示例：openssl rand -base64 48）。' +
        '请在 .env / docker-compose 环境变量中配置后再启动。',
    );
  }
  return secret;
}
