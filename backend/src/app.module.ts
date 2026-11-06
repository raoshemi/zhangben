import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { CashFlowModule } from './cashflow/cashflow.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { LedgersModule } from './ledgers/ledgers.module';
import { ClosingModule } from './closing/closing.module';
import { ReportsModule } from './reports/reports.module';
import { AssetsModule } from './assets/assets.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';

@Module({
  imports: [
    PrismaModule,
    BootstrapModule,
    AuthModule,
    AccountsModule,
    CashFlowModule,
    VouchersModule,
    LedgersModule,
    ClosingModule,
    ReportsModule,
    AssetsModule,
  ],
})
export class AppModule {}
