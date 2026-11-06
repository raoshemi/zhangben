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
import { AccountsService } from './accounts.service';
import {
  CreateBookDto,
  CreateAccountDto,
  CreateAuxiliaryDto,
  UpdateBookDto,
  UpdateAccountDto,
} from './dto';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  // 账套
  @Get('books')
  listBooks() {
    return this.service.listBooks();
  }

  @Get('books/:id')
  getBook(@Param('id', ParseIntPipe) id: number) {
    return this.service.getBook(id);
  }

  @Roles('admin')
  @Post('books')
  createBook(@Body() dto: CreateBookDto) {
    return this.service.createBook(dto);
  }

  @Roles('admin')
  @Patch('books/:id')
  updateBook(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookDto) {
    return this.service.updateBook(id, dto);
  }

  // 科目
  @Get('accounts')
  listAccounts(@Query('bookId', ParseIntPipe) bookId: number) {
    return this.service.listAccounts(bookId);
  }

  @Roles('admin')
  @Post('accounts')
  createAccount(@Body() dto: CreateAccountDto) {
    return this.service.createAccount(dto);
  }

  @Roles('admin')
  @Patch('accounts/:id')
  updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.service.updateAccount(id, dto);
  }

  @Roles('admin')
  @Delete('accounts/:id')
  deleteAccount(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteAccount(id);
  }

  // 辅助核算
  @Get('auxiliary')
  listAuxiliary(
    @Query('bookId', ParseIntPipe) bookId: number,
    @Query('auxType') auxType?: string,
  ) {
    return this.service.listAuxiliary(bookId, auxType);
  }

  @Roles('admin')
  @Post('auxiliary')
  createAuxiliary(@Body() dto: CreateAuxiliaryDto) {
    return this.service.createAuxiliary(dto);
  }

  @Roles('admin')
  @Delete('auxiliary/:id')
  deleteAuxiliary(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteAuxiliary(id);
  }
}
