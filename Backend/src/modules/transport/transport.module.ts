import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { StudentsModule } from '../students/students.module';
import { TransportController } from './controllers/transport.controller';
import { Bus, TransportRoute } from './entities/transport.entities';
import { TransportService } from './services/transport.service';

@Module({
  imports: [SequelizeModule.forFeature([TransportRoute, Bus]), StudentsModule],
  controllers: [TransportController],
  providers: [TransportService],
  exports: [SequelizeModule, TransportService],
})
export class TransportModule {}
