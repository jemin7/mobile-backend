import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { SalaryCycleService } from './salary-cycle.service';
import { CreateSalaryCycleDto } from './dto/create-salary-cycle.dto';
import { UpdateSalaryCycleDto } from './dto/update-salary-cycle.dto';
import { FindSalaryCycleQueryDto } from './dto/find-salary-cycle.query.dto';

@Controller('salary-cycle')
export class SalaryCycleController {
  constructor(private readonly service: SalaryCycleService) {}

  @Post()
  create(@Body() dto: CreateSalaryCycleDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

     // 🔹 New endpoint
  @Get('company/:companyID')
  findByCompany(@Param('companyID', ParseIntPipe) companyID: number) {
    return this.service.findByCompany(companyID);
  }

  @Get('employee/:employeeId/periods')
  periodsForEmployee(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.service.periodsForEmployee(employeeId);
  }

  @Get('employee/:employeeId/resolve')
  resolveForEmployee(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query('monthPeriod') monthPeriod?: string,
  ) {
    return this.service.resolveForEmployee(employeeId, monthPeriod ?? '');
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSalaryCycleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
