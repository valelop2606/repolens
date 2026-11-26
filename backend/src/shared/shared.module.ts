import { Module, Global } from '@nestjs/common';

/**
 * SharedModule is @Global: put cross-cutting providers here so domain
 * modules can use them without re-importing.
 */
@Global()
@Module({})
export class SharedModule {}
