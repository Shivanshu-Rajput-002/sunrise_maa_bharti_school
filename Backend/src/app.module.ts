import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { ScopeInterceptor } from './common/interceptors/scope.interceptor';
import { configs } from './config';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AcademicModule } from './modules/academic/academic.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StudentsModule } from './modules/students/students.module';
import { TransportModule } from './modules/transport/transport.module';
import { FeesModule } from './modules/fees/fees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ExamsModule } from './modules/exams/exams.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { PortalModule } from './modules/portal/portal.module';
import { StaffModule } from './modules/staff/staff.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: configs, validate: validateEnv }),
    DatabaseModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get('jwt.expiresIn', '15m') },
      }),
    }),
    // Default: 120 requests / minute / IP. Login has a stricter per-route limit.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      errorMessage: 'Too many attempts. Please wait a minute and try again.',
    }),

    AdminModule,
    AcademicModule,
    AuthModule,
    StudentsModule,
    TransportModule,
    FeesModule,
    AttendanceModule,
    StaffModule,
    ExamsModule,
    CommunicationModule,
    ReportsModule,
    PortalModule,
  ],
  controllers: [AppController],
  providers: [
    // Order matters: rate-limit → authenticate → authorize; then scope resolution
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: ScopeInterceptor },
  ],
})
export class AppModule {}
