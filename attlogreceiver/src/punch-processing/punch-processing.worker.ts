import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PunchProcessingService } from './punch-processing.service';

@Injectable()
export class PunchProcessingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PunchProcessingWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly processing: PunchProcessingService) {}

  onModuleInit(): void {
    if (process.env.WORKER_EMBEDDED === 'false') {
      this.logger.log('embedded worker disabled');
      return;
    }
    const interval = Number(process.env.WORKER_INTERVAL_MS || 2000);
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
    this.timer.unref?.();
    this.logger.log(`embedded worker started interval=${interval}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const retried = await this.processing.retryFailedPunches();
      const processed = await this.processing.processAvailable();
      if (retried > 0 || processed > 0) {
        this.logger.log(`worker retried=${retried} processed=${processed}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'worker_failed';
      this.logger.error(message);
    } finally {
      this.running = false;
    }
  }
}
