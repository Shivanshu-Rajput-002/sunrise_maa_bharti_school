import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from '../admin/entities/user.entity';
import { FeePayment } from '../fees/entities/fee.entities';
import { Certificate } from '../students/entities/certificate.entity';
import { StudentEnrollment } from '../students/entities/student-enrollment.entity';
import { AttendanceModule } from '../attendance/attendance.module';
import { CommunicationModule } from '../communication/communication.module';
import { FeesModule } from '../fees/fees.module';
import { StaffModule } from '../staff/staff.module';
import { StudentsModule } from '../students/students.module';
import { DashboardController } from './controllers/dashboard.controller';
import { ReportsController } from './controllers/reports.controller';
import { DashboardService } from './services/dashboard.service';
import { ReportsService } from './services/reports.service';

@Module({
  imports: [SequelizeModule.forFeature([StudentEnrollment, FeePayment, Certificate, User]), StudentsModule, StaffModule, FeesModule, AttendanceModule, CommunicationModule],
  controllers: [DashboardController, ReportsController],
  providers: [DashboardService, ReportsService],
})
export class ReportsModule {}
