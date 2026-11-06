import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  enterpriseAccounts,
  smallAccounts,
  defaultCashFlowItems,
  SeedAccount,
} from '../src/shared/account-chart';
import { buildPeriods } from '../src/shared/periods';

const prisma = new PrismaClient();

async function insertAccountTree(
  bookId: number,
  accounts: SeedAccount[],
  parentId: number | null = null,
  level = 1,
) {
  for (const a of accounts) {
    const hasChildren = !!a.children && a.children.length > 0;
    const account = await prisma.account.create({
      data: {
        bookId,
        code: a.code,
        name: a.name,
        category: a.category,
        balanceSide: a.side,
        level,
        parentId,
        isLeaf: !hasChildren,
        auxFlags: a.aux ?? [],
      },
    });
    if (hasChildren) {
      await insertAccountTree(bookId, a.children!, account.id, level + 1);
    }
  }
}

async function main() {
  console.log('Seeding 账本记账系统 ...');

  // 默认管理员
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      displayName: '系统管理员',
      role: 'admin',
    },
  });
  console.log('管理员用户:', admin.username);

  // 演示用户（职责分离：制单 / 审核 / 记账）
  const demoUsers = [
    { username: 'bookkeeper', password: 'bookkeeper123', role: 'bookkeeper', displayName: '制单员' },
    { username: 'approver', password: 'approver123', role: 'approver', displayName: '审核员' },
    { username: 'poster', password: 'poster123', role: 'poster', displayName: '记账员' },
    { username: 'viewer', password: 'viewer123', role: 'viewer', displayName: '查看员' },
  ];
  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        passwordHash: await bcrypt.hash(u.password, 10),
        displayName: u.displayName,
        role: u.role,
      },
    });
  }
  console.log('演示用户已创建（bookkeeper/approver/poster）');

  // 现金流量项目（建账套后按账套复制）
  // 默认账套：企业会计准则
  const existingBook = await prisma.accountBook.findFirst({
    where: { name: '默认账套' },
  });
  if (!existingBook) {
    const book = await prisma.accountBook.create({
      data: {
        name: '默认账套',
        accountingStandard: 'enterprise',
        baseCurrency: 'CNY',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    await insertAccountTree(book.id, enterpriseAccounts);
    await prisma.cashFlowItem.createMany({
      data: defaultCashFlowItems.map((c) => ({
        bookId: book.id,
        code: c.code,
        name: c.name,
        category: c.category,
      })),
    });
    console.log('已创建默认账套(企业会计准则) + 会计科目 + 现金流量项目');
  }

  // 幂等：为所有账套补建缺失的会计期间
  const allBooks = await prisma.accountBook.findMany();
  for (const b of allBooks) {
    const periodCount = await prisma.period.count({ where: { bookId: b.id } });
    if (periodCount === 0) {
      await prisma.period.createMany({
        data: buildPeriods(b.id, b.startDate, b.endDate),
      });
    }
  }

  console.log('Seed 完成');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
