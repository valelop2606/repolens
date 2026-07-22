import { RepositoryTree, PartialAnalysisResult } from '../../../shared/types';

/**
 * Analyzer interface — every technology-specific analyzer must implement this.
 *
 * Extensibility rule: adding a new analyzer (e.g. SpringBootAnalyzer) requires
 * only creating a new class that implements this interface and registering it
 * in AnalysisModule.  No existing code changes needed.
 */
export interface Analyzer {
  /** Human-readable name used in warnings and logs */
  readonly name: string;

  /** Return true when this analyzer is applicable to the given repository */
  detect(repo: RepositoryTree): boolean;

  /** Perform analysis and return a partial result */
  analyze(repo: RepositoryTree): Promise<PartialAnalysisResult>;
}
