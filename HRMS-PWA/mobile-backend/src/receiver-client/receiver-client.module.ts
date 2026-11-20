import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { EsslRawProcessorModule } from '../essl-raw-processor/essl-raw-processor.module';
import { ReceiverClientService } from './receiver-client.service';
import { ReceiverClientController } from './receiver-client.controller';

@Global()
@Module({
  imports: [
    EsslRawProcessorModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret123',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [ReceiverClientController],
  providers: [ReceiverClientService, JwtStrategy],
  exports: [ReceiverClientService],
})
export class ReceiverClientModule {}
