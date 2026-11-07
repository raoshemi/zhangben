import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import {
  CreateBookDto,
  CreateAccountDto,
  CreateAuxiliaryDto,
  SaveInitialBalancesDto,
  UpdateBookDto,
  UpdateAccountDto,
} from './dto';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  // 账套
  @Get('books')
  listBooks(@Query('includeArchived') includeArchived?: string) {
    return this.service.listBooks(includeArchived === 'true');
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

  /** 归档账套：归档后不再出现在启用列表，不能再录入凭证，但历史数据保留可查 */
  @Roles('admin')
  @Post('books/:id/archive')
  archiveBook(@Param('id', ParseIntPipe) id: number) {
    return this.service.archiveBook(id);
  }

  /** 重新启用已归档账套 */
  @Roles('admin')
  @Post('books/:id/restore')
  restoreBook(@Param('id', ParseIntPipe) id: number) {
    return this.service.restoreBook(id);
  }

  /** 彻底删除账套（有凭证时禁止，需改用归档） */
  @Roles('admin')
  @Delete('books/:id')
  deleteBook(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteBook(id);
  }

  // 科目
  @Get('accounts')
  listAccounts(@Query('bookId', ParseIntPipe) bookId: number) {
    return this.service.listAccounts(bookId);
  }

  /** 期初余额录入（期初建账）：整体保存，校验借贷平衡 + 只能明细科目 + 已记账锁定 */
  @Roles('admin', 'bookkeeper')
  @Put('accounts/initial-balances')
  saveInitialBalances(@Body() dto: SaveInitialBalancesDto) {
    return this.service.saveInitialBalances(
      dto.bookId,
      dto.items,
      dto.auxItems ?? [],
    );
  }

  /** 期初辅助核算明细（供页面对往来科目展开编辑） */
  @Get('accounts/initial-balances/aux')
  listInitialAux(@Query('bookId', ParseIntPipe) bookId: number) {
    return this.service.listInitialAux(bookId);
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
