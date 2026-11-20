import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { SalaryAdvanceService } from './salary-advance.service';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { UpdateSalaryAdvanceDto } from './dto/update-salary-advance.dto';
import { ScheduleSalaryAdvanceDto } from './dto/schedule-salary-advance.dto';
import { DisburseSalaryAdvanceDto } from './dto/disburse-salary-advance.dto';

@Controller('salary-advance')
export class SalaryAdvanceController {
  constructor(private readonly service: SalaryAdvanceService) {}

  @Post()
  create(@Body() dto: CreateSalaryAdvanceDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('employee/:empId')
  findByEmployee(@Param('empId', ParseIntPipe) empId: number) {
    return this.service.findByEmployee(empId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(':id/schedule')
  schedule(@Param('id', ParseIntPipe) id: number, @Body() dto: ScheduleSalaryAdvanceDto) {
    return this.service.replaceSchedule(id, dto);
  }

  @Post(':id/disburse')
  disburse(@Param('id', ParseIntPipe) id: number, @Body() dto: DisburseSalaryAdvanceDto) {
    return this.service.disburse(id, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSalaryAdvanceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
