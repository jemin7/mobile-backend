import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdministrationModule } from './administration/administration.module';
import { AuthenticationModule } from './authentication/authentication.module';
import { DatabaseModule } from './database/database.module';
import { DeviceRoutingModule } from './device-routing/device-routing.module';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { MobileModule } from './mobile/mobile.module';
import { PunchProcessingModule } from './punch-processing/punch-processing.module';
import { RawLogModule } from './raw-log/raw-log.module';
import { DahuaModule } from './vendors/dahua/dahua.module';
import { EsslModule } from './vendors/essl/essl.module';
import { ZktecoModule } from './vendors/zkteco/zkteco.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 600 }]),
    DatabaseModule,
    AuthenticationModule,
    DevicesModule,
    RawLogModule,
    PunchProcessingModule,
    EsslModule,
    ZktecoModule,
    DeviceRoutingModule,
    DahuaModule,
    MobileModule,
    AdministrationModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
