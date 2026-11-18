import { Global, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RolesController } from './controllers/roles.controller';
import { SettingsController } from './controllers/settings.controller';
import { UsersController } from './controllers/users.controller';
import { AuditLog } from './entities/audit-log.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';
import { Setting } from './entities/setting.entity';
import { User } from './entities/user.entity';
import { AuditService } from './services/audit.service';
import { RbacService } from './services/rbac.service';
import { RolesService } from './services/roles.service';
import { SettingsService } from './services/settings.service';
import { UsersService } from './services/users.service';

/** Global so RbacService / AuditService / SettingsService are injectable everywhere */
@Global()
@Module({
  imports: [SequelizeModule.forFeature([User, Role, Permission, RolePermission, AuditLog, Setting])],
  controllers: [UsersController, RolesController, SettingsController],
  providers: [RbacService, AuditService, UsersService, RolesService, SettingsService],
  exports: [SequelizeModule, RbacService, AuditService, SettingsService],
})
export class AdminModule {}
