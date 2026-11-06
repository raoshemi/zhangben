import { Type } from 'class-transformer';
import { IsIn, IsInt, Matches, Min } from 'class-validator';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class LedgerQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookId: number;

  @Matches(PERIOD_PATTERN, { message: 'period 必须为 YYYY-MM 格式' })
  period: string;
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
