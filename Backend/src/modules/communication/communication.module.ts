import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { NoticesController } from './controllers/notices.controller';
import { Notice } from './entities/notice.entity';
import { NoticesService } from './services/notices.service';

@Module({
  imports: [SequelizeModule.forFeature([Notice])],
  controllers: [NoticesController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class CommunicationModule {}
