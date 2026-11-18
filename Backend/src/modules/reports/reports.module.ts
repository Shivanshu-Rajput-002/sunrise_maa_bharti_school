import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { CommunicationModule } from '../communication/communication.module';
import { FeesModule } from '../fees/fees.module';
import { StudentsModule } from '../students/students.module';
import { DashboardController } from './controllers/dashboard.controller';
import { ReportsController } from './controllers/reports.controller';
import { DashboardService } from './services/dashboard.service';
import { ReportsService } from './services/reports.service';

@Module({
  imports: [StudentsModule, FeesModule, AttendanceModule, CommunicationModule],
  controllers: [DashboardController, ReportsController],
  providers: [DashboardService, ReportsService],
})
export class ReportsModule {}
