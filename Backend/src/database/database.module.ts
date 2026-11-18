import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { HtmlPdfService } from '../common/pdf/html-pdf.service';
import { SequenceService } from './sequence.service';

@Global()
@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'mysql',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        database: config.get<string>('database.name'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        logging: config.get<boolean>('database.logging') ? console.log : false,
        timezone: '+05:30',
        autoLoadModels: true,
        synchronize: false, // schema changes only via migrations
        pool: { max: 10, min: 0, idle: 10_000, acquire: 30_000 },
      }),
    }),
  ],
  providers: [SequenceService, HtmlPdfService],
  exports: [SequenceService, HtmlPdfService],
})
export class DatabaseModule {}
