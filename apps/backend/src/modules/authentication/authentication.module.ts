import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';

// Authentication behavior belongs to Phase 2.
@Module({ imports: [UsersModule] })
export class AuthenticationModule {}
