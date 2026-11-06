import { Matches } from 'class-validator';

export class DepreciateQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'period 必须为 YYYY-MM 格式',
  })
  period: string;
}
