import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { friendlyValidationFactory } from './common/errors/friendly-validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const prefix = config.get<string>('app.apiPrefix', 'api');

  app.set('trust proxy', 1); // correct client IP behind Nginx (rate limiting, audit)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(cookieParser());

  // The biometric machine still posts to the old site's path (no /api prefix)
  app.setGlobalPrefix(prefix, { exclude: [{ path: 'Api/attendence.php', method: RequestMethod.POST }] });
  app.enableCors({
    origin: config.get<string>('app.corsOrigin')!.split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: friendlyValidationFactory }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.enableShutdownHooks();

  const port = config.get<number>('app.port', 5000);
  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}/${prefix}`, 'Bootstrap');
}
bootstrap();
