import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('balance-sheet')
  balanceSheet(@Query() query: ReportQueryDto) {
    // 资产负债表是「时点」报表，取结束期间
    return this.reports.balanceSheet(query.bookId, query.endPeriod ?? query.period);
  }

  @Get('income-statement')
  incomeStatement(@Query() query: ReportQueryDto) {
    // 利润表是「期间」报表，可跨月累计
    return this.reports.incomeStatement(
      query.bookId,
      query.startPeriod ?? query.period,
      query.endPeriod ?? query.period,
    );
  }

  @Get('cash-flow')
  cashFlow(@Query() query: ReportQueryDto) {
    return this.reports.cashFlow(
      query.bookId,
      query.startPeriod ?? query.period,
      query.endPeriod ?? query.period,
    );
  }
}
