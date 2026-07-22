import { Module } from '@nestjs/common';
import { DocumentationController } from './documentation.controller';
import { DocumentationGenerator } from './documentation.generator';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [DocumentationController],
  providers: [DocumentationGenerator],
  exports: [DocumentationGenerator],
})
export class DocumentationModule {}
