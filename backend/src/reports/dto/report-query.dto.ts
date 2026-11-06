import { Type } from 'class-transformer';
import { IsInt, Matches, Min } from 'class-validator';

export class ReportQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'bookId 必须为整数' })
  @Min(1, { message: 'bookId 必须大于 0' })
  bookId: number;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'period 必须为 YYYY-MM 格式',
  })
  period: string;
}
