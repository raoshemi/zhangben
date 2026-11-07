import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

/** 期初余额单条（按科目天然方向录入：借方科目填 initialDebit，贷方科目填 initialCredit） */
export class InitialBalanceItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId: number;

  @IsOptional()
  @IsString()
  initialDebit?: string;

  @IsOptional()
  @IsString()
  initialCredit?: string;
}

export class SaveInitialBalancesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialBalanceItemDto)
  items: InitialBalanceItemDto[];
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
