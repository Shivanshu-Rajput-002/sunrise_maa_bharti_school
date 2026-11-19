import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from '../admin/entities/user.entity';
import { StaffController } from './controllers/staff.controller';
import { Staff, StaffAttendance } from './entities/staff.entities';
import { StaffService } from './services/staff.service';

@Module({
  imports: [SequelizeModule.forFeature([Staff, StaffAttendance, User])],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
