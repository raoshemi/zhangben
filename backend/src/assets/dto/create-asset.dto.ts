import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAssetDto {
  @Type(() => Number)
  @IsInt({ message: 'bookId 必须为整数' })
  @Min(1)
  bookId: number;

  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @Matches(/^\d{1,16}(\.\d{1,2})?$/, {
    message: 'originalValue 必须为金额（最多 2 位小数）',
  })
  originalValue: string;

  @IsOptional()
  @Matches(/^[01](\.\d{1,4})?$/, {
    message: 'residualRate 必须为 0~1 的小数（最多 4 位小数）',
  })
  residualRate?: string;

  @Type(() => Number)
  @IsInt({ message: 'usefulLife 必须为整数' })
  @Min(1, { message: '使用月数必须大于 0' })
  usefulLife: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  depreciationMethod?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate 必须为 YYYY-MM-DD 格式',
  })
  startDate: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  depreciationAccountId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  accumulatedDepreciationAccountId: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
