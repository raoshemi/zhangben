import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const VOUCHER_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'posted',
  'voided',
] as const;

export class QueryVoucherDto {
  @Type(() => Number)
  @IsInt()
  bookId: number;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsIn(VOUCHER_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
