import { Controller, Get, Query } from '@nestjs/common';
import { LedgersService } from './ledgers.service';
import {
  DetailQueryDto,
  JournalQueryDto,
  LedgerQueryDto,
} from './dto/ledger-query.dto';

@Controller('ledgers')
export class LedgersController {
  constructor(private readonly ledgers: LedgersService) {}

  @Get('books')
  books() {
    return this.ledgers.books();
  }

  @Get('general')
  general(@Query() q: LedgerQueryDto) {
    return this.ledgers.general(q.bookId, q.period);
  }

  @Get('detail')
  detail(@Query() q: DetailQueryDto) {
    return this.ledgers.detail(q.bookId, q.period, q.accountId);
  }

  @Get('journal')
  journal(@Query() q: JournalQueryDto) {
    return this.ledgers.journal(q.bookId, q.period, q.type);
  }

  @Get('account-balance')
  accountBalance(@Query() q: LedgerQueryDto) {
    return this.ledgers.accountBalance(q.bookId, q.period);
  }

  @Get('trial-balance')
  trialBalance(@Query() q: LedgerQueryDto) {
    return this.ledgers.trialBalance(q.bookId, q.period);
  }
}
