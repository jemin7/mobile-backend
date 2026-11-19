import { INestApplication, ValidationPipe } from '@nestjs/common';
import { json, text, urlencoded, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { isDeviceRoute } from './common/constants/routes';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

export function configureApp(app: INestApplication): void {
  const limit = process.env.BODY_LIMIT || '1mb';
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return next();
    }
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (isDeviceRoute(path)) {
      // Dahua labels a plain or multipart punch as deflate. Unzipping it throws
      // "incorrect header check" and the punch is never stored.
      if (path.toLowerCase().includes('/dahua')) {
        return readRawBody(byteLimit(limit))(req, res, next);
      }
      return text({ type: () => true, limit })(req, res, next);
    }
    const contentType = String(req.headers['content-type'] || '');
    if (contentType.includes('application/json')) {
      return json({ limit })(req, res, next);
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return urlencoded({ extended: false, limit })(req, res, next);
    }
    return text({ type: () => true, limit })(req, res, next);
  });
  app.use(helmet());
  const server = app.getHttpAdapter().getInstance() as { set?: (key: string, value: number) => void };
  server.set?.('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new BigIntInterceptor());
}

function byteLimit(value: string): number {
  const match = /^(\d+)\s*(b|kb|mb)?$/i.exec(value.trim());
  if (!match) {
    return 1024 * 1024;
  }
  const amount = Number(match[1]);
  const unit = (match[2] || 'b').toLowerCase();
  if (unit === 'mb') {
    return amount * 1024 * 1024;
  }
  if (unit === 'kb') {
    return amount * 1024;
  }
  return amount;
}

function readRawBody(limitBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk: Buffer) => {
      if (settled) {
        return;
      }
      size += chunk.length;
      if (size > limitBytes) {
        settled = true;
        res.status(413).type('text/plain').send('ERROR');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) {
        return;
      }
      settled = true;
      req.body = Buffer.concat(chunks);
      next();
    });
    req.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      next(error);
    });
  };
}
