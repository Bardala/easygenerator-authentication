import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AppConfigurationModule } from '../configuration/app-configuration.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { LoggingModule } from '../logging/logging.module.js';
import { AuthenticationController } from './authentication.controller.js';
import { AuthenticationService } from './authentication.service.js';
import { PasswordService } from './services/password.service.js';
import { SessionService } from './services/session.service.js';
import { CsrfService } from './services/csrf.service.js';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import { MongoSessionAdapter } from './adapters/mongo-session.adapter.js';

@Module({
  imports: [UsersModule, AppConfigurationModule, DatabaseModule, LoggingModule],
  controllers: [AuthenticationController],
  providers: [
    MongoSessionAdapter,
    AuthenticationService,
    PasswordService,
    SessionService,
    CsrfService,
    SessionAuthGuard,
    CsrfGuard,
  ],
  exports: [SessionService, CsrfService, SessionAuthGuard],
})
export class AuthenticationModule {}
