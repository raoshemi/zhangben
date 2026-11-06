import { Module } from '@nestjs/common';
import { CashFlowController } from './cashflow.controller';
import { CashFlowService } from './cashflow.service';

@Module({
  controllers: [CashFlowController],
  providers: [CashFlowService],
})
export class CashFlowModule {}
