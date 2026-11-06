import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ReportQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'bookId 必须为整数' })
  @Min(1, { message: 'bookId 必须大于 0' })
  bookId: number;

  @Matches(PERIOD_RE, { message: 'period 必须为 YYYY-MM 格式' })
  period: string;

  @IsOptional()
  @Matches(PERIOD_RE, { message: 'startPeriod 必须为 YYYY-MM 格式' })
  startPeriod?: string;

  @IsOptional()
  @Matches(PERIOD_RE, { message: 'endPeriod 必须为 YYYY-MM 格式' })
  endPeriod?: string;
}
