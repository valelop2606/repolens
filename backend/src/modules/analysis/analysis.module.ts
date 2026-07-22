import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ProjectsModule } from '../projects/projects.module';

/**
 * AnalysisModule — owns the full repository analysis pipeline.
 *
 * Pipeline stages:
 *  1. RepositoryLoader   — ZIP validation and extraction
 *  2. TechDetectionAnalyzer — technology detection
 *  3. AnalysisEngine     — runs all registered analyzers
 *  5. KnowledgeBuilder   — assembles the Knowledge Base
 */
@Module({
  imports: [KnowledgeModule, ProjectsModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
