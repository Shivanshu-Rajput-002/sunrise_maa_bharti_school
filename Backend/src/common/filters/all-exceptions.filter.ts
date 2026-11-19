import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import {
  ConnectionError,
  DatabaseError,
  ForeignKeyConstraintError,
  TimeoutError,
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from 'sequelize';
import { fieldLabel } from '../errors/friendly-validation';

/** Default framework texts → plain language */
const BY_STATUS: Partial<Record<number, string>> = {
  400: 'Some details are not valid. Please check and try again.',
  401: 'Please sign in to continue.',
  403: 'You do not have permission for this action.',
  404: 'This page or record was not found.',
  405: 'This action is not allowed.',
  408: 'The request took too long. Please try again.',
  409: 'This conflicts with existing data.',
  413: 'The file or data is too large.',
  415: 'This file type is not supported.',
  429: 'Too many attempts. Please wait a minute and try again.',
  500: 'Something went wrong on our side. Please try again.',
  502: 'The server is not responding right now. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
};

/** Framework default messages that are too technical to show as-is */
const TECHNICAL = [/^Cannot (GET|POST|PUT|PATCH|DELETE) /i, /^Unexpected token/i, /JSON/, /ThrottlerException/i, /^Internal server error$/i, /^Bad Request$/i, /^Not Found$/i, /^Forbidden resource$/i, /^Unauthorized$/i, /^Payload Too Large$/i];

interface Out {
  status: number;
  message: string;
  errors?: string[];
}

/**
 * Every error leaves the API as { success:false, statusCode, message, errors?, ref? }.
 * `message` is always one readable sentence; `errors` lists field problems; `ref` lets
 * the office quote an id that matches the server log for unexpected (5xx) errors.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const out = this.translate(exception);

    let ref: string | undefined;
    if (out.status >= 500) {
      ref = randomBytes(4).toString('hex').toUpperCase();
      this.logger.error(`[${ref}] ${req.method} ${req.originalUrl}`, exception instanceof Error ? exception.stack : String(exception));
    }
    if (res.headersSent) return;
    res.status(out.status).json({ success: false, statusCode: out.status, message: out.message, ...(out.errors?.length ? { errors: out.errors } : {}), ...(ref ? { ref } : {}) });
  }

  private translate(e: unknown): Out {
    // ---- database errors (Sequelize) ----
    if (e instanceof UniqueConstraintError) {
      const fields = Object.keys(e.fields ?? {}).filter((f) => f !== 'PRIMARY').map(fieldLabel);
      return { status: 409, message: fields.length ? `${fields.join(', ')} is already used. Please enter a different value.` : 'This record already exists.' };
    }
    if (e instanceof ForeignKeyConstraintError) {
      const deleting = /delete|update/i.test(e.message) && /a parent row/i.test(e.message);
      return {
        status: 409,
        message: deleting ? 'This record is used elsewhere, so it cannot be removed. Remove the linked entries first.' : 'A linked record (class, student, exam …) was not found. Please refresh and try again.',
      };
    }
    if (e instanceof SequelizeValidationError) {
      const errors = (e.errors ?? []).map((x) => `${fieldLabel(x.path ?? '')}: ${x.message}`);
      return { status: 400, message: errors[0] ?? BY_STATUS[400]!, errors };
    }
    if (e instanceof ConnectionError || e instanceof TimeoutError) {
      return { status: 503, message: 'The database is not reachable right now. Please try again in a moment.' };
    }
    if (e instanceof DatabaseError) {
      const msg = String((e as DatabaseError).parent?.message ?? e.message);
      if (/Data too long/i.test(msg)) return { status: 400, message: `${fieldLabel(/column '([^']+)'/.exec(msg)?.[1]?.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) ?? 'A value')} is too long.` };
      if (/Out of range|Incorrect (integer|decimal|date)/i.test(msg)) return { status: 400, message: 'One of the values is not valid (number or date out of range).' };
      return { status: 500, message: BY_STATUS[500]! };
    }

    // ---- file upload (multer) ----
    if (e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string' && String((e as { code: string }).code).startsWith('LIMIT_')) {
      const code = (e as { code: string }).code;
      return { status: 413, message: code === 'LIMIT_FILE_SIZE' ? 'The file is too large.' : 'Too many files or fields in the upload.' };
    }

    // ---- HTTP exceptions (our own + framework) ----
    if (e instanceof HttpException) {
      const status = e.getStatus();
      const body = e.getResponse();
      let message: unknown = typeof body === 'string' ? body : (body as { message?: unknown })?.message;
      let errors: string[] | undefined = typeof body === 'object' && body ? ((body as { errors?: string[] }).errors ?? undefined) : undefined;
      if (Array.isArray(message)) {
        errors = message.map(String);
        message = errors.slice(0, 4).join('. ');
      }
      let text = typeof message === 'string' && message.trim() ? message.trim() : BY_STATUS[status] ?? BY_STATUS[500]!;
      if (TECHNICAL.some((rx) => rx.test(text))) text = BY_STATUS[status] ?? BY_STATUS[500]!;
      return { status, message: text, errors };
    }

    // ---- body parser: malformed JSON etc. ----
    if (e && typeof e === 'object' && 'type' in e && (e as { type?: string }).type === 'entity.parse.failed') {
      return { status: 400, message: 'The request could not be read. Please refresh the page and try again.' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: BY_STATUS[500]! };
  }
}
