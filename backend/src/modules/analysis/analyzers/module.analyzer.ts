import { v4 as uuidv4 } from 'uuid';
import {
  RepositoryTree,
  PartialAnalysisResult,
  Module,
  DependencyEdge,
  AnalysisWarning,
} from '../../../shared/types';
import { Analyzer } from '../interfaces/analyzer.interface';

/**
 * Stage 3 of the analysis pipeline — Module Extraction.
 *
 * Grouping strategy:
 *  1. Group all files by their top-level directory segment.
 *  2. A directory qualifies as a module boundary if it contains index.ts or index.js.
 *  3. For each qualifying module: assign id (UUID), name, rootPath, files list, and description.
 *  4. Compute inter-module import edges by scanning import/require statements.
 *  5. Detect circular dependencies via DFS and record them as warnings.
 *
 * Satisfies Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export class ModuleAnalyzer implements Analyzer {
  readonly name = 'ModuleAnalyzer';

  /** Applicable whenever the repository has at least one file. */
  detect(repo: RepositoryTree): boolean {
    return repo.files.length > 0;
  }

  async analyze(repo: RepositoryTree): Promise<PartialAnalysisResult> {
    // ----------------------------------------------------------------
    // 1. Group files by top-level directory
    // ----------------------------------------------------------------
    const dirToFiles = new Map<string, string[]>();

    for (const file of repo.files) {
      const topDir = this._topLevelDir(file.relativePath);
      if (!topDir) continue; // skip root-level files

      if (!dirToFiles.has(topDir)) {
        dirToFiles.set(topDir, []);
      }
      dirToFiles.get(topDir)!.push(file.relativePath);
    }

    // ----------------------------------------------------------------
    // 2. Keep only directories that contain index.ts or index.js
    // ----------------------------------------------------------------
    const moduleDirs = new Map<string, string[]>(); // dir → file list

    for (const [dir, files] of dirToFiles) {
      const hasIndex = files.some(
        (f) => f === `${dir}/index.ts` || f === `${dir}/index.js`,
      );
      if (hasIndex) {
        moduleDirs.set(dir, files);
      }
    }

    // ----------------------------------------------------------------
    // 3. Build Module records
    // ----------------------------------------------------------------
    const modules: Module[] = [];
    const nameToId = new Map<string, string>(); // dir name → module id

    for (const [dir, files] of moduleDirs) {
      const id = uuidv4();
      nameToId.set(dir, id);

      modules.push({
        id,
        name: dir,
        rootPath: dir,
        files,
        description: `Module handling ${dir} functionality`,
        dependencies: [], // filled in step 5
      });
    }

    // ----------------------------------------------------------------
    // 4. Build a file → module-dir lookup for fast cross-module checks
    // ----------------------------------------------------------------
    const fileToDir = new Map<string, string>();
    for (const [dir, files] of moduleDirs) {
      for (const f of files) {
        fileToDir.set(f, dir);
      }
    }

    // ----------------------------------------------------------------
    // 5. Scan imports/requires to build dependency edges
    // ----------------------------------------------------------------
    // import ... from '../otherModule/...'   or   require('../otherModule/...')
    const importPattern =
      /(?:import\s+(?:.*?\s+from\s+)?|require\s*\(\s*)['"](\.[^'"]+)['"]/g;

    const rawEdges = new Set<string>(); // "fromDir->toDir" de-duplication key
    const edgeList: DependencyEdge[] = [];

    // Also build adjacency for circular detection (module id → set of module ids)
    const adjacency = new Map<string, Set<string>>();
    for (const mod of modules) {
      adjacency.set(mod.id, new Set());
    }

    for (const file of repo.files) {
      const fromDir = fileToDir.get(file.relativePath);
      if (!fromDir) continue; // file is not in any tracked module

      const fromId = nameToId.get(fromDir)!;

      let match: RegExpExecArray | null;
      importPattern.lastIndex = 0;

      while ((match = importPattern.exec(file.content)) !== null) {
        const importPath = match[1];
        const resolvedDir = this._resolveImportDir(fromDir, importPath);

        if (!resolvedDir || resolvedDir === fromDir) continue; // same module or unresolvable
        if (!nameToId.has(resolvedDir)) continue; // target is not a known module

        const toId = nameToId.get(resolvedDir)!;
        const key = `${fromDir}->${resolvedDir}`;

        if (!rawEdges.has(key)) {
          rawEdges.add(key);
          adjacency.get(fromId)!.add(toId);
          // isCircular will be set after cycle detection
          edgeList.push({ from: fromId, to: toId, isCircular: false });
        }
      }
    }

    // ----------------------------------------------------------------
    // 6. Detect circular dependencies (DFS)
    // ----------------------------------------------------------------
    const circularPairs = this._detectCircularPairs(adjacency);
    const warnings: AnalysisWarning[] = [];

    for (const edge of edgeList) {
      const pairKey = `${edge.from}:${edge.to}`;
      if (circularPairs.has(pairKey)) {
        edge.isCircular = true;

        // Resolve human-readable names for the warning message
        const fromName = modules.find((m) => m.id === edge.from)?.name ?? edge.from;
        const toName = modules.find((m) => m.id === edge.to)?.name ?? edge.to;

        warnings.push({
          code: 'CIRCULAR_DEPENDENCY',
          message: `Circular dependency detected between modules "${fromName}" and "${toName}"`,
          file: null,
          severity: 'warning',
        });
      }
    }

    // ----------------------------------------------------------------
    // 7. Populate Module.dependencies arrays
    // ----------------------------------------------------------------
    const idToModule = new Map<string, Module>(modules.map((m) => [m.id, m]));

    for (const edge of edgeList) {
      const fromMod = idToModule.get(edge.from);
      if (fromMod && !fromMod.dependencies.includes(edge.to)) {
        fromMod.dependencies.push(edge.to);
      }
    }

    return {
      modules,
      dependencyEdges: edgeList,
      warnings,
    };
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  /**
   * Returns the top-level directory of a relative path, or null for root files.
   * e.g. "src/modules/auth/index.ts" → "src"
   *      "README.md"                  → null
   */
  private _topLevelDir(relativePath: string): string | null {
    const normalized = relativePath.replace(/\\/g, '/');
    const slashIdx = normalized.indexOf('/');
    if (slashIdx === -1) return null;
    return normalized.slice(0, slashIdx);
  }

  /**
   * Resolves an import specifier (relative path) from a source directory to
   * the top-level module directory it points into, if any.
   *
   * Examples:
   *   fromDir="src/auth", importPath="../payments/service" → "src/payments"
   *   fromDir="src/auth", importPath="./utils"             → "src/auth" (same module, skip)
   */
  private _resolveImportDir(fromDir: string, importPath: string): string | null {
    // Split fromDir into segments, append a dummy filename for resolution
    const fromParts = fromDir.split('/');
    const importParts = importPath.split('/');

    // Navigate the path segments
    const stack = [...fromParts];

    for (const seg of importParts) {
      if (seg === '..') {
        if (stack.length > 0) stack.pop();
      } else if (seg !== '.') {
        stack.push(seg);
      }
    }

    if (stack.length === 0) return null;
    return stack[0]; // top-level directory
  }

  /**
   * Returns a Set of "fromId:toId" strings for all edges that participate in a cycle.
   * Uses iterative DFS with back-edge detection.
   */
  private _detectCircularPairs(
    adjacency: Map<string, Set<string>>,
  ): Set<string> {
    const circularPairs = new Set<string>();

    // Standard DFS coloring: 0 = unvisited, 1 = in stack, 2 = done
    const color = new Map<string, number>();
    for (const id of adjacency.keys()) color.set(id, 0);

    const dfs = (nodeId: string, stack: string[]): void => {
      color.set(nodeId, 1);
      stack.push(nodeId);

      for (const neighborId of adjacency.get(nodeId) ?? []) {
        if (color.get(neighborId) === 1) {
          // Back edge found → cycle. Mark all edges in the current stack path
          // that are part of the cycle.
          const cycleStart = stack.indexOf(neighborId);
          for (let i = cycleStart; i < stack.length - 1; i++) {
            circularPairs.add(`${stack[i]}:${stack[i + 1]}`);
          }
          // Also the closing edge back to neighborId
          circularPairs.add(`${stack[stack.length - 1]}:${neighborId}`);
        } else if (color.get(neighborId) === 0) {
          dfs(neighborId, stack);
        }
      }

      stack.pop();
      color.set(nodeId, 2);
    };

    for (const id of adjacency.keys()) {
      if (color.get(id) === 0) {
        dfs(id, []);
      }
    }

    return circularPairs;
  }
}
