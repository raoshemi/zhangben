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
  UseGuards,
} from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { QueryVoucherDto } from './dto/query-voucher.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@Controller('vouchers')
@UseGuards(RolesGuard)
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Roles('admin', 'bookkeeper')
  @Post()
  create(@Body() dto: CreateVoucherDto, @CurrentUser() user: AuthUser) {
    return this.vouchers.create(dto, user);
  }

  @Get()
  findAll(@Query() query: QueryVoucherDto) {
    return this.vouchers.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vouchers.findOne(id);
  }

  @Roles('admin', 'bookkeeper')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVoucherDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vouchers.update(id, dto, user);
  }

  @Roles('admin', 'bookkeeper')
  @Post(':id/submit')
  submit(@Param('id', ParseIntPipe) id: number) {
    return this.vouchers.submit(id);
  }

  @Roles('approver', 'admin')
  @Post(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.vouchers.approve(id, user);
  }

  @Roles('poster', 'admin')
  @Post(':id/post')
  post(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.vouchers.post(id, user);
  }

  @Roles('poster', 'admin')
  @Post(':id/reverse')
  reverse(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.vouchers.reverse(id, user);
  }

  @Roles('admin', 'bookkeeper')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vouchers.remove(id);
  }
}
