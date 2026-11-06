import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CashFlowService } from './cashflow.service';
import { CashFlowDto, UpdateCashFlowDto } from './dto';
import { Roles } from '../auth/roles.decorator';

@Controller('cashflow')
export class CashFlowController {
  constructor(private readonly service: CashFlowService) {}

  @Get()
  list(@Query('bookId', ParseIntPipe) bookId: number) {
    return this.service.list(bookId);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CashFlowDto) {
    return this.service.create(dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCashFlowDto) {
    return this.service.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
