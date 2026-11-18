import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshDays: parseInt(process.env.REFRESH_TOKEN_DAYS || '7', 10),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
}));
