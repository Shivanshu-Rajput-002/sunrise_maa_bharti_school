import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { StaffModule } from '../staff/staff.module';
import { StudentsModule } from '../students/students.module';
import { AttendanceController } from './controllers/attendance.controller';
import { LegacyBiometricController } from './controllers/legacy-biometric.controller';
import { Attendance, BiometricDevice, Holiday } from './entities/attendance.entities';
import { AttendanceService } from './services/attendance.service';

@Module({
  imports: [SequelizeModule.forFeature([Attendance, Holiday, BiometricDevice]), StudentsModule, StaffModule],
  controllers: [AttendanceController, LegacyBiometricController],
  providers: [AttendanceService],
  exports: [AttendanceService, SequelizeModule],
})
export class AttendanceModule {}
