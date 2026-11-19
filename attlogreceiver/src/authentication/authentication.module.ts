import { Module } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { DeviceIpGuard } from './device-ip.guard';
import { ReceiverKeyGuard } from './receiver-key.guard';

@Module({
  providers: [ReceiverKeyGuard, AdminAuthGuard, DeviceIpGuard],
  exports: [ReceiverKeyGuard, AdminAuthGuard, DeviceIpGuard],
})
export class AuthenticationModule {}
