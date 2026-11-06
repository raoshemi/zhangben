import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('balance-sheet')
  balanceSheet(@Query() query: ReportQueryDto) {
    return this.reports.balanceSheet(query.bookId, query.period);
  }

  @Get('income-statement')
  incomeStatement(@Query() query: ReportQueryDto) {
    return this.reports.incomeStatement(query.bookId, query.period);
  }

  @Get('cash-flow')
  cashFlow(@Query() query: ReportQueryDto) {
    return this.reports.cashFlow(query.bookId, query.period);
  }
}
