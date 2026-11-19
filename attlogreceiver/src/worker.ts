import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  process.env.TZ = process.env.TIMEZONE || 'Asia/Kolkata';
  process.env.WORKER_EMBEDDED = 'true';
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
}

void bootstrap();
