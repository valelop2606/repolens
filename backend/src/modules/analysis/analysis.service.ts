import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { RepositoryLoader, RepositoryLoaderError } from './pipeline/repository-loader';
import { AnalysisEngine } from './pipeline/analysis-engine';
import { KnowledgeBuilder } from './pipeline/knowledge-builder';
import { TechDetectionAnalyzer } from './analyzers/tech-detection.analyzer';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ProjectsService } from '../projects/projects.service';
import { KnowledgeBase } from '../../shared/types';

/**
 * AnalysisService orchestrates the full repository analysis pipeline:
 *
 *   ZIP buffer
 *     → RepositoryLoader    (Stage 1 — load & validate)
 *     → TechDetectionAnalyzer (Stage 2 — detect technologies)
 *     → AnalysisEngine      (Stage 3 — run all analyzers)
 *     → KnowledgeBuilder    (Stage 5 — assemble KB)
 *     → KnowledgeService    (persist to MongoDB)
 *
 * Architectural rule: AI (Bedrock) receives the *completed KB*, not the raw repo.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  private readonly loader = new RepositoryLoader();
  private readonly engine = new AnalysisEngine([
    new TechDetectionAnalyzer(),
    // Future analyzers are registered here (e.g. ModuleAnalyzer, ReactComponentAnalyzer)
  ]);
  private readonly builder = new KnowledgeBuilder();

  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly projectsService: ProjectsService,
  ) {}

  async analyzeRepository(projectId: string, zipBuffer: Buffer): Promise<KnowledgeBase> {
    // Mark project as processing
    await this.projectsService.updateStatus(projectId, 'processing');

    try {
      // Stage 1 — load
      this.logger.log(`[${projectId}] Stage 1: Loading repository`);
      const repo = this.loader.load(zipBuffer);

      // Stage 3 — run analyzers
      this.logger.log(`[${projectId}] Stage 3: Running analysis engine`);
      const partials = await this.engine.run(repo);

      // Stage 5 — assemble knowledge base
      this.logger.log(`[${projectId}] Stage 5: Building knowledge base`);
      const kb = this.builder.assemble(partials, repo, projectId);

      // Persist
      const saved = await this.knowledgeService.save(kb);

      // Update project with KB reference and detected technologies
      await this.projectsService.updateStatus(projectId, 'completed', {
        knowledgeBaseId: saved.sessionId,
        technologies: kb.technologies.map((t) => t.name),
      });

      this.logger.log(`[${projectId}] Analysis complete. Session: ${saved.sessionId}`);
      return saved;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.projectsService.updateStatus(projectId, 'failed', {
        errorMessage: message,
      });

      if (err instanceof RepositoryLoaderError) {
        throw new BadRequestException({ code: err.code, message });
      }
      throw err;
    }
  }
}
