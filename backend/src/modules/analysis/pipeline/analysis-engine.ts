import { Logger } from '@nestjs/common';
import { RepositoryTree, PartialAnalysisResult, AnalysisWarning } from '../../../shared/types';
import { Analyzer } from '../interfaces/analyzer.interface';

/**
 * Stage 3 of the analysis pipeline.
 *
 * Orchestrates all registered Analyzer implementations.
 * Fault-isolated: one failing analyzer does not abort the pipeline.
 * Extensible: new analyzers are injected — no code changes here.
 */
export class AnalysisEngine {
  private readonly logger = new Logger(AnalysisEngine.name);

  constructor(private readonly analyzers: Analyzer[]) {}

  async run(repo: RepositoryTree): Promise<PartialAnalysisResult[]> {
    const results: PartialAnalysisResult[] = [];

    for (const analyzer of this.analyzers) {
      if (!analyzer.detect(repo)) {
        this.logger.debug(`Skipping analyzer "${analyzer.name}" — not applicable`);
        continue;
      }

      try {
        this.logger.log(`Running analyzer "${analyzer.name}"`);
        const result = await analyzer.analyze(repo);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const warning: AnalysisWarning = {
          code: 'ANALYZER_ERROR',
          message: `Analyzer "${analyzer.name}" failed: ${message}`,
          file: null,
          severity: 'warning',
        };
        this.logger.warn(warning.message);
        results.push({ warnings: [warning] });
      }
    }

    return results;
  }
}
