import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashFlowDto } from './dto';

@Injectable()
export class CashFlowService {
  constructor(private readonly prisma: PrismaService) {}

  list(bookId: number) {
    return this.prisma.cashFlowItem.findMany({
      where: { bookId },
      orderBy: { code: 'asc' },
    });
  }

  create(dto: CashFlowDto) {
    return this.prisma.cashFlowItem.create({ data: dto });
  }

  update(id: number, dto: Partial<CashFlowDto>) {
    return this.prisma.cashFlowItem.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.cashFlowItem.delete({ where: { id } });
  }
}
