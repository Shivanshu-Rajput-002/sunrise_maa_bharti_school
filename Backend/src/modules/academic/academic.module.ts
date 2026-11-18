import { Global, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AcademicController } from './controllers/academic.controller';
import { AcademicSession } from './entities/academic-session.entity';
import { Medium } from './entities/medium.entity';
import { SchoolClass } from './entities/school-class.entity';
import { Section } from './entities/section.entity';
import { Subject } from './entities/subject.entity';
import { ClassesService } from './services/classes.service';
import { ScopeService } from './services/scope.service';
import { SessionsService } from './services/sessions.service';

/** Global so ScopeService / SessionsService are available to the scope interceptor and auth */
@Global()
@Module({
  imports: [SequelizeModule.forFeature([AcademicSession, Medium, SchoolClass, Section, Subject])],
  controllers: [AcademicController],
  providers: [ScopeService, SessionsService, ClassesService],
  exports: [SequelizeModule, ScopeService, SessionsService],
})
export class AcademicModule {}
