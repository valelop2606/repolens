import { v4 as uuidv4 } from 'uuid';
import {
  KnowledgeBase,
  PartialAnalysisResult,
  RepositoryTree,
  ProjectMetadata,
  DependencyGraph,
} from '../../../shared/types';

/**
 * Stage 5 of the analysis pipeline — Knowledge Builder.
 *
 * Merges all PartialAnalysisResult objects from the analyzer pipeline
 * into a single, complete KnowledgeBase.
 *
 * Rule: the KB is the Single Source of Truth.
 * All features (chat, documentation, explorer) consume the KB;
 * they never re-analyze the repository.
 */
export class KnowledgeBuilder {
  assemble(
    partials: PartialAnalysisResult[],
    repo: RepositoryTree,
    projectId: string,
  ): KnowledgeBase {
    const technologies = partials.flatMap((p) => p.technologies ?? []);
    const modules = partials.flatMap((p) => p.modules ?? []);
    const endpoints = partials.flatMap((p) => p.endpoints ?? []);
    const components = partials.flatMap((p) => p.components ?? []);
    const entities = partials.flatMap((p) => p.entities ?? []);
    const dependencyEdges = partials.flatMap((p) => p.dependencyEdges ?? []);
    const warnings = partials.flatMap((p) => p.warnings ?? []);

    const metadata = this._buildMetadata(repo);

    const dependencyGraph: DependencyGraph = {
      nodes: modules.map((m) => m.id),
      edges: dependencyEdges,
    };

    return {
      sessionId: uuidv4(),
      projectId,
      createdAt: new Date(),
      metadata,
      technologies,
      modules,
      endpoints,
      components,
      entities,
      dependencyGraph,
      featureFlows: [],
      warnings,
      isComplete: true,
    };
  }

  private _buildMetadata(repo: RepositoryTree): ProjectMetadata {
    const pkg = repo.packageJson ?? {};
    return {
      name: (pkg['name'] as string) ?? 'Unknown Project',
      version: (pkg['version'] as string) ?? '0.0.0',
      description: (pkg['description'] as string) ?? '',
      dependencies: (pkg['dependencies'] as Record<string, string>) ?? {},
      hasPackageJson: repo.packageJson !== null,
    };
  }
}
