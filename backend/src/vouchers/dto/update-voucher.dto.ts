import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { VOUCHER_TYPES, VoucherEntryDto } from './create-voucher.dto';

export class UpdateVoucherDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式必须为 YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsIn(VOUCHER_TYPES)
  voucherType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  attachmentCount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, { message: '凭证至少需要两行分录' })
  @ValidateNested({ each: true })
  @Type(() => VoucherEntryDto)
  entries?: VoucherEntryDto[];
}
