import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeBaseRecord, KnowledgeBaseSchema } from './schemas/knowledge-base.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnowledgeBaseRecord.name, schema: KnowledgeBaseSchema },
    ]),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
