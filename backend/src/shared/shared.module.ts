import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './services/storage.service';
import awsConfig from './config/aws.config';

/**
 * SharedModule is marked @Global so StorageService is available
 * in every domain module without re-importing.
 */
@Global()
@Module({
  imports: [ConfigModule.forFeature(awsConfig)],
  providers: [StorageService],
  exports: [StorageService],
})
export class SharedModule {}
