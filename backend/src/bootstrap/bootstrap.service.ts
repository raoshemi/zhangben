import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 生产首次启动引导：
 * 全新数据库（无任何用户）时自动创建管理员，避免部署后无人能登录。
 * 幂等：已有用户就什么都不做。
 *
 * 安全约定：
 * - 优先使用 ADMIN_PASSWORD 环境变量；未设置则生成一次性随机密码，只打印一次。
 * - 不使用固定默认口令（历史版本曾用 admin123，属于后门）。
 */
@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureAdmin();
  }

  private async ensureAdmin() {
    const count = await this.prisma.user.count();
    if (count > 0) return;

    const username = process.env.ADMIN_USERNAME ?? 'admin';
    const provided = process.env.ADMIN_PASSWORD;
    const password = provided ?? randomBytes(12).toString('base64url');
    await this.prisma.user.create({
      data: {
        username,
        displayName: '系统管理员',
        passwordHash: await bcrypt.hash(password, 12),
        role: 'admin',
      },
    });

    if (provided) {
      this.logger.warn(
        `首次启动：已创建管理员 ${username}（初始密码来自 ADMIN_PASSWORD 环境变量，请登录后尽快修改）。`,
      );
    } else {
      this.logger.warn(
        `首次启动：已创建管理员 ${username}，一次性初始密码：${password}（仅此一次显示，请立即登录并修改）。`,
      );
    }
  }
}
