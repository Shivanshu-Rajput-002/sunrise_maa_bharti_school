import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthController } from './controllers/auth.controller';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthService } from './services/auth.service';

@Module({
  imports: [SequelizeModule.forFeature([RefreshToken])],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
