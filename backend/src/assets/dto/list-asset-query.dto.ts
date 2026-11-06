import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListAssetQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'bookId 必须为整数' })
  @Min(1)
  bookId?: number;
}
