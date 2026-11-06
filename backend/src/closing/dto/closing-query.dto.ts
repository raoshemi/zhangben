import { Type } from 'class-transformer';
import { IsInt, Matches, Min } from 'class-validator';

export class ClosingQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookId: number;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period 必须为 YYYY-MM 格式' })
  period: string;
}

export class BookQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookId: number;
}
