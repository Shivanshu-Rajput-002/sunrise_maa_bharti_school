import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser, Public, SkipScope } from '../../../common/decorators';
import { REFRESH_COOKIE } from '../../../common/constants';
import type { AuthUser } from '../../../common/interfaces/request-context';
import { ChangePasswordDto, LoginDto, RefreshDto } from '../dto/auth.dto';
import { AuthService } from '../services/auth.service';

@SkipScope()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('login-options')
  loginOptions() {
    return this.auth.loginOptions();
  }

  /** Brute-force protection: 5 attempts / minute / IP */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, refreshExpiresAt, ...result } = await this.auth.login(dto, this.client(req));
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions(refreshExpiresAt));
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, refreshExpiresAt, ...result } = await this.auth.refresh(
      req.cookies?.[REFRESH_COOKIE],
      dto.sessionId,
      this.client(req),
    );
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions(refreshExpiresAt));
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), expires: undefined });
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Post('change-password')
  @HttpCode(200)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }

  private client(req: Request) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  private cookieOptions(expires?: Date): CookieOptions {
    const prefix = this.config.get<string>('app.apiPrefix', 'api');
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('jwt.cookieSecure', false),
      sameSite: 'lax',
      path: `/${prefix}/auth`,
      expires,
    };
  }
}
