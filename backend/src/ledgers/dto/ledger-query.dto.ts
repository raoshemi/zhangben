import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class LedgerQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookId: number;

  /** 结束期间（余额类账簿按此时点；流水类账簿用 [startPeriod, period]） */
  @Matches(PERIOD_PATTERN, { message: 'period 必须为 YYYY-MM 格式' })
  period: string;

  /** 起始期间（可选，不传则等于 period） */
  @IsOptional()
  @Matches(PERIOD_PATTERN, { message: 'startPeriod 必须为 YYYY-MM 格式' })
  startPeriod?: string;
}

export class DetailQueryDto extends LedgerQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId: number;
}

export class JournalQueryDto extends LedgerQueryDto {
  @IsIn(['cash', 'bank'])
  type: 'cash' | 'bank';
}
