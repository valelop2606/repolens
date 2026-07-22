import { RepositoryTree, PartialAnalysisResult, AnalysisWarning } from '../types/index';
import { Analyzer } from '../analyzers/analyzer.interface';

export class AnalysisEngine {
  private readonly analyzers: Analyzer[];

  constructor(analyzers: Analyzer[]) {
    this.analyzers = analyzers;
  }

  async run(repo: RepositoryTree): Promise<PartialAnalysisResult[]> {
    const results: PartialAnalysisResult[] = [];

    for (const analyzer of this.analyzers) {
      // Skip analyzers that don't apply to this repository
      if (!analyzer.detect(repo)) {
        continue;
      }

      try {
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
        results.push({ warnings: [warning] });
      }
    }

    return results;
  }
}
