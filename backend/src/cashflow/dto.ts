import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CashFlowDto {
  @IsInt()
  bookId: number;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['operating', 'investing', 'financing'])
  category: string;
}

export class UpdateCashFlowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['operating', 'investing', 'financing'])
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
