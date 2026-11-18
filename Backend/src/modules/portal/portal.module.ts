import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { CommunicationModule } from '../communication/communication.module';
import { ExamsModule } from '../exams/exams.module';
import { FeesModule } from '../fees/fees.module';
import { StudentsModule } from '../students/students.module';
import { TransportModule } from '../transport/transport.module';
import { PortalController } from './controllers/portal.controller';
import { PortalService } from './services/portal.service';

@Module({
  imports: [StudentsModule, FeesModule, AttendanceModule, ExamsModule, CommunicationModule, TransportModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
