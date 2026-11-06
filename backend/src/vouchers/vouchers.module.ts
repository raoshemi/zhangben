import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [VouchersController],
  providers: [VouchersService, RolesGuard],
})
export class VouchersModule {}
