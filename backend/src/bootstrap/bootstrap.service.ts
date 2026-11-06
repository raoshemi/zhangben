import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 生产首次启动引导：
 * 全新数据库（无任何用户）时自动创建管理员，避免部署后无人能登录。
 * 幂等：已有用户就什么都不做。
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
    const password = process.env.ADMIN_PASSWORD ?? 'admin123';
    await this.prisma.user.create({
      data: {
        username,
        displayName: '系统管理员',
        passwordHash: await bcrypt.hash(password, 10),
        role: 'admin',
      },
    });
    this.logger.warn(
      `首次启动：已创建管理员 ${username}（初始密码 ${password}），请登录后立即修改密码。`,
    );
  }
}
