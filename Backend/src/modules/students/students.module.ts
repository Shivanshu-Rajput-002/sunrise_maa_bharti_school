import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { StudentsController } from './controllers/students.controller';
import { Certificate } from './entities/certificate.entity';
import { StudentEnrollment } from './entities/student-enrollment.entity';
import { Student } from './entities/student.entity';
import { StudentDocumentsService } from './services/student-documents.service';
import { ParentsService } from './services/parents.service';
import { StudentImportService } from './services/student-import.service';
import { StudentsService } from './services/students.service';

@Module({
  imports: [SequelizeModule.forFeature([Student, StudentEnrollment, Certificate])],
  controllers: [StudentsController],
  providers: [StudentsService, StudentDocumentsService, StudentImportService, ParentsService],
  exports: [StudentsService, SequelizeModule],
})
export class StudentsModule {}
