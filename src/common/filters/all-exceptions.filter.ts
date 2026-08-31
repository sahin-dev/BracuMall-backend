import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

const PRISMA_STATUS_MAP: Record<string, number> = {
  P2002: HttpStatus.CONFLICT, // unique constraint violation
  P2025: HttpStatus.NOT_FOUND, // record not found
  P2003: HttpStatus.BAD_REQUEST, // foreign key constraint failure
};

const PRISMA_MESSAGE_MAP: Record<string, string> = {
  P2002: 'A record with this value already exists',
  P2025: 'Record not found',
  P2003: 'This action references a record that no longer exists',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      ...body,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolve(exception: unknown): { status: number; body: Record<string, unknown> } {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const body =
        typeof payload === 'string' ? { message: payload } : (payload as Record<string, unknown>);
      return { status: exception.getStatus(), body };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const status = PRISMA_STATUS_MAP[exception.code] ?? HttpStatus.BAD_REQUEST;
      const message = PRISMA_MESSAGE_MAP[exception.code] ?? 'Invalid request';
      return { status, body: { message } };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { message: 'Internal server error' },
    };
  }
}
