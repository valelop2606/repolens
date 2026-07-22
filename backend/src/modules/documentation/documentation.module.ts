import { Module } from '@nestjs/common';
import { DocumentationGenerator } from './documentation.generator';

@Module({
  providers: [DocumentationGenerator],
  exports: [DocumentationGenerator],
})
export class DocumentationModule {}
