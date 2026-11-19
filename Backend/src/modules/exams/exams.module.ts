import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { StudentsModule } from '../students/students.module';
import { ExamsController } from './controllers/exams.controller';
import { AcademicSession } from '../academic/entities/academic-session.entity';
import { Attendance } from '../attendance/entities/attendance.entities';
import { StudentEnrollment } from '../students/entities/student-enrollment.entity';
import { Exam, ExamMark, ExamSchedule } from './entities/exam.entities';
import { ReportCardExtra } from './entities/report-card-extra.entity';
import { ExamPrintService } from './services/exam-print.service';
import { MarksExcelService } from './services/marks-excel.service';
import { ExamsService } from './services/exams.service';

@Module({
  imports: [SequelizeModule.forFeature([Exam, ExamSchedule, ExamMark, ReportCardExtra, Attendance, StudentEnrollment, AcademicSession]), StudentsModule],
  controllers: [ExamsController],
  providers: [ExamsService, ExamPrintService, MarksExcelService],
  exports: [ExamsService, ExamPrintService],
})
export class ExamsModule {}
