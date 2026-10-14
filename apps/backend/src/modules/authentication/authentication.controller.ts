import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import { EmptyBodyGuard } from '../../common/guards/empty-body.guard.js';
import { AuthenticationService } from './authentication.service.js';
import { SignUpReqDto } from './dtos/sign-up-req.dto.js';
import { SignInReqDto } from './dtos/sign-in-req.dto.js';
import {
  AuthenticationResDto,
  CsrfResDto,
  CurrentUserResDto,
} from './dtos/authentication-res.dto.js';
import { CsrfService } from './services/csrf.service.js';
import { SessionService } from './services/session.service.js';

@ApiTags('Authentication')
@ApiHeader({
  name: 'X-CSRF-Token',
  required: false,
  description: 'Required on POST requests; obtain from GET /api/auth/csrf.',
})
@Controller('auth')
@UseGuards(CsrfGuard)
export class AuthenticationController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly csrf: CsrfService,
    private readonly sessions: SessionService,
  ) {}

  @Get('csrf')
  @ApiOkResponse({ type: CsrfResDto })
  async token(@Req() req: Request): Promise<CsrfResDto> {
    const existing = req.session.csrfToken;
    const csrfToken = this.csrf.token(req);
    if (!existing) await this.sessions.save(req);
    return { csrfToken };
  }
  @Post('sign-up')
  @ApiCreatedResponse({ type: AuthenticationResDto })
  signUp(
    @Req() req: Request,
    @Body() input: SignUpReqDto,
  ): Promise<AuthenticationResDto> {
    return this.authentication.signUp(req, input);
  }
  @Post('sign-in')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthenticationResDto })
  signIn(
    @Req() req: Request,
    @Body() input: SignInReqDto,
  ): Promise<AuthenticationResDto> {
    return this.authentication.signIn(req, input);
  }
  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: CurrentUserResDto })
  currentUser(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CurrentUserResDto> {
    return this.authentication.currentUser(req, res);
  }
  @Post('sign-out')
  @UseGuards(EmptyBodyGuard)
  @HttpCode(204)
  @ApiNoContentResponse()
  signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.sessions.destroy(req, res);
  }
}
