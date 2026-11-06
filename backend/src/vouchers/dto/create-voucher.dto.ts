import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const VOUCHER_TYPES = ['记', '收', '付', '转'] as const;

export const AUX_TYPES = [
  'customer',
  'supplier',
  'department',
  'employee',
  'project',
] as const;

export class VoucherEntryAuxDto {
  @IsIn(AUX_TYPES)
  auxType: string;

  @Type(() => Number)
  @IsInt()
  auxiliaryItemId: number;
}

export class VoucherEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  summary: string;

  @Type(() => Number)
  @IsInt()
  accountId: number;

  @IsIn(['debit', 'credit'])
  direction: 'debit' | 'credit';

  // 金额以字符串传输，存储/运算使用 Prisma.Decimal，禁止浮点
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: '金额必须为非负数字，最多两位小数' })
  amount: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cashflowItemId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoucherEntryAuxDto)
  auxs?: VoucherEntryAuxDto[];
}

export class CreateVoucherDto {
  @Type(() => Number)
  @IsInt()
  bookId: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: '会计期间格式必须为 YYYY-MM' })
  period: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式必须为 YYYY-MM-DD' })
  date: string;

  @IsIn(VOUCHER_TYPES)
  voucherType: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  voucherNo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  attachmentCount?: number;

  @IsArray()
  @ArrayMinSize(2, { message: '凭证至少需要两行分录' })
  @ValidateNested({ each: true })
  @Type(() => VoucherEntryDto)
  entries: VoucherEntryDto[];
}
