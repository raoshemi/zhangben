import { Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ClosingService } from './closing.service';
import { BookQueryDto, ClosingQueryDto } from './dto/closing-query.dto';

@Controller('closing')
export class ClosingController {
  constructor(private readonly closing: ClosingService) {}

  @Get('periods')
  periods(@Query() q: BookQueryDto) {
    return this.closing.periods(q.bookId);
  }

  @Roles('admin')
  @Post('profit-transfer')
  profitTransfer(@Query() q: ClosingQueryDto, @CurrentUser() user: AuthUser) {
    return this.closing.profitTransfer(q.bookId, q.period, user.id);
  }

  @Roles('admin')
  @Post('close')
  close(@Query() q: ClosingQueryDto, @CurrentUser() user: AuthUser) {
    return this.closing.close(q.bookId, q.period, user.id);
  }

  @Roles('admin')
  @Post('reopen')
  reopen(@Query() q: ClosingQueryDto) {
    return this.closing.reopen(q.bookId, q.period);
  }
}
