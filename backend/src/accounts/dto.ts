import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBookDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['enterprise', 'small'])
  accountingStandard: string;

  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}

export class UpdateBookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAccountDto {
  @IsInt()
  bookId: number;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['asset', 'liability', 'common', 'equity', 'cost', 'pnl'])
  category: string;

  @IsIn(['debit', 'credit'])
  balanceSide: string;

  @IsOptional()
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsArray()
  auxFlags?: string[];

  @IsOptional()
  @IsBoolean()
  isQuantity?: boolean;

  @IsOptional()
  @IsBoolean()
  isForeign?: boolean;

  @IsOptional()
  @IsString()
  initialDebit?: string;

  @IsOptional()
  @IsString()
  initialCredit?: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  auxFlags?: string[];
}

export class CreateAuxiliaryDto {
  @IsInt()
  bookId: number;

  @IsIn(['customer', 'supplier', 'department', 'employee', 'project'])
  auxType: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
