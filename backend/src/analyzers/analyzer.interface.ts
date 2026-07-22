import { RepositoryTree, PartialAnalysisResult } from '../types/index';

export interface Analyzer {
  name: string;
  detect(repo: RepositoryTree): boolean;
  analyze(repo: RepositoryTree): Promise<PartialAnalysisResult>;
}
