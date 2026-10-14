import { HttpStatus, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApplicationError } from '../../common/errors/application.error.js';
import { UsersService } from '../users/users.service.js';
import { PasswordService } from './services/password.service.js';
import { SessionService } from './services/session.service.js';
import type { SignUpReqDto } from './dtos/sign-up-req.dto.js';
import type { SignInReqDto } from './dtos/sign-in-req.dto.js';
import type {
  AuthenticationResDto,
  CurrentUserResDto,
} from './dtos/authentication-res.dto.js';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async signUp(
    req: Request,
    input: SignUpReqDto,
  ): Promise<AuthenticationResDto> {
    const hash = await this.passwords.hash(input.password);
    const user = await this.users.create(input.email, input.name, hash);
    return { user, csrfToken: await this.sessions.establish(req, user.id) };
  }
  async signIn(
    req: Request,
    input: SignInReqDto,
  ): Promise<AuthenticationResDto> {
    const credentials = await this.users.findCredentials(input.email);
    if (
      !(await this.passwords.verify(
        credentials?.passwordHash,
        input.password,
      )) ||
      !credentials
    ) {
      throw new ApplicationError(HttpStatus.UNAUTHORIZED, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }
    const user = {
      id: credentials._id.toString(),
      email: credentials.email,
      name: credentials.name,
    };
    return { user, csrfToken: await this.sessions.establish(req, user.id) };
  }
  async currentUser(req: Request, res: Response): Promise<CurrentUserResDto> {
    const user = await this.users.findPublic(req.session.userId ?? '');
    if (!user) {
      await this.sessions.destroy(req, res);
      throw new ApplicationError(HttpStatus.UNAUTHORIZED, {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }
    return { user };
  }
}
