import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isDeviceRoute } from '../constants/routes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.messageOf(exception).replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://***');
    if (status >= 500) {
      this.logger.error(`${request.method} ${request.path} ${message}`);
    }

    if (isDeviceRoute(request.path || request.url || '')) {
      if (status === HttpStatus.UNAUTHORIZED && (request.path || '').toLowerCase().includes('dahua')) {
        response.setHeader('WWW-Authenticate', 'Basic realm="ATTLOG"');
      }
      response.status(status).type('text/plain; charset=utf-8').send('ERROR');
      return;
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
    });
  }

  private messageOf(exception: unknown): string {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return body;
      }
      if (typeof body === 'object' && body && 'message' in body) {
        const message = (body as { message: unknown }).message;
        return Array.isArray(message) ? message.join('; ') : String(message);
      }
    }
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'internal_error';
  }
}
