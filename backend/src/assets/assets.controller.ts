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
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { ListAssetQueryDto } from './dto/list-asset-query.dto';
import { DepreciateQueryDto } from './dto/depreciate-query.dto';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@Roles('admin')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post()
  create(@Body() dto: CreateAssetDto) {
    return this.assets.create(dto);
  }

  @Get()
  findAll(@Query() query: ListAssetQueryDto) {
    return this.assets.findAll(query.bookId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.assets.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.assets.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.assets.remove(id);
  }

  @Post(':id/depreciate')
  depreciate(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DepreciateQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assets.depreciate(id, query.period, user?.id);
  }
}
