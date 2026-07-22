// Feature: codebase-understanding-platform, Property 5, 6

import * as fc from 'fast-check';
import { ModuleAnalyzer } from './module.analyzer';
import { RepositoryTree, FileEntry } from '../../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileEntry(
  relativePath: string,
  content = '',
  extension?: string,
): FileEntry {
  const ext = extension ?? (relativePath.includes('.') ? '.' + relativePath.split('.').pop() : '');
  return { relativePath, content, extension: ext };
}

function makeRepo(files: FileEntry[]): RepositoryTree {
  return {
    rootPath: '/',
    files,
    packageJson: null,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const analyzer = new ModuleAnalyzer();

// Arbitrary that generates between 1 and 8 unique lowercase directory names
const arbDirNames = fc.uniqueArray(
  fc.stringMatching(/^[a-z][a-z0-9]{2,7}$/),
  { minLength: 1, maxLength: 8 },
);

// ---------------------------------------------------------------------------
// Property 5 — Index-file module detection and completeness
// Validates: Requirements 3.2, 3.3
// ---------------------------------------------------------------------------

describe('Property 5a — N dirs with index.ts produce exactly N modules (Req 3.2)', () => {
  it('every directory with index.ts becomes exactly one module', async () => {
    await fc.assert(
      fc.asyncProperty(arbDirNames, async (dirs) => {
        const files = dirs.map((dir) => makeFileEntry(`${dir}/index.ts`, '', '.ts'));
        const repo = makeRepo(files);
        const result = await analyzer.analyze(repo);
        const modules = result.modules ?? [];
        expect(modules).toHaveLength(dirs.length);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 5b — N dirs with index.js produce exactly N modules (Req 3.2)', () => {
  it('every directory with index.js becomes exactly one module', async () => {
    await fc.assert(
      fc.asyncProperty(arbDirNames, async (dirs) => {
        const files = dirs.map((dir) => makeFileEntry(`${dir}/index.js`, '', '.js'));
        const repo = makeRepo(files);
        const result = await analyzer.analyze(repo);
        const modules = result.modules ?? [];
        expect(modules).toHaveLength(dirs.length);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 5c — Mixed index.ts / index.js per directory (Req 3.2)', () => {
  it('each qualifying directory with either index file produces exactly one module', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbDirNames,
        fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
        async (dirs, useTs) => {
          const files = dirs.map((dir, i) => {
            const ext = useTs[i % useTs.length] ? 'ts' : 'js';
            return makeFileEntry(`${dir}/index.${ext}`, '', `.${ext}`);
          });
          const repo = makeRepo(files);
          const result = await analyzer.analyze(repo);
          const modules = result.modules ?? [];
          expect(modules).toHaveLength(dirs.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 5d — Each module record has all required non-empty fields (Req 3.3)', () => {
  it('every module has non-empty id, name, rootPath, non-empty files array, and description', async () => {
    await fc.assert(
      fc.asyncProperty(arbDirNames, async (dirs) => {
        const files = dirs.map((dir) => makeFileEntry(`${dir}/index.ts`, '', '.ts'));
        const repo = makeRepo(files);
        const result = await analyzer.analyze(repo);
        const modules = result.modules ?? [];

        for (const mod of modules) {
          // id: non-empty UUID-like string
          expect(mod.id.length).toBeGreaterThan(0);
          // name: non-empty
          expect(mod.name.length).toBeGreaterThan(0);
          // rootPath: non-empty
          expect(mod.rootPath.length).toBeGreaterThan(0);
          // files: array with at least 1 entry
          expect(Array.isArray(mod.files)).toBe(true);
          expect(mod.files.length).toBeGreaterThanOrEqual(1);
          // description: non-empty
          expect(mod.description.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 5e — Directories WITHOUT an index file are NOT treated as modules (Req 3.2)', () => {
  it('a directory containing only non-index files produces no module', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate dirs that will have index files (qualifying)
        arbDirNames,
        // Generate a separate set of dirs that won't have index files (non-qualifying)
        fc.uniqueArray(
          fc.stringMatching(/^z[a-z0-9]{3,7}$/), // prefix 'z' to avoid collision
          { minLength: 1, maxLength: 4 },
        ),
        async (qualifyingDirs, nonQualifyingDirs) => {
          // Ensure no overlap between the two sets
          const allDirs = new Set([...qualifyingDirs, ...nonQualifyingDirs]);
          if (allDirs.size !== qualifyingDirs.length + nonQualifyingDirs.length) {
            // Overlap detected; skip this run
            return;
          }

          const qualifyingFiles = qualifyingDirs.map((dir) =>
            makeFileEntry(`${dir}/index.ts`, '', '.ts'),
          );
          const nonQualifyingFiles = nonQualifyingDirs.flatMap((dir) => [
            makeFileEntry(`${dir}/service.ts`, '', '.ts'),
            makeFileEntry(`${dir}/helper.ts`, '', '.ts'),
          ]);

          const repo = makeRepo([...qualifyingFiles, ...nonQualifyingFiles]);
          const result = await analyzer.analyze(repo);
          const modules = result.modules ?? [];
          const moduleNames = new Set(modules.map((m) => m.name));

          // All qualifying dirs must be modules
          for (const dir of qualifyingDirs) {
            expect(moduleNames).toContain(dir);
          }
          // Non-qualifying dirs must NOT be modules
          for (const dir of nonQualifyingDirs) {
            expect(moduleNames).not.toContain(dir);
          }
          // Total count must match qualifying dirs only
          expect(modules).toHaveLength(qualifyingDirs.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 5f — description follows the exact template "Module handling <name> functionality" (Req 3.3)', () => {
  it('each module description matches the expected template', async () => {
    await fc.assert(
      fc.asyncProperty(arbDirNames, async (dirs) => {
        const files = dirs.map((dir) => makeFileEntry(`${dir}/index.ts`, '', '.ts'));
        const repo = makeRepo(files);
        const result = await analyzer.analyze(repo);
        const modules = result.modules ?? [];

        for (const mod of modules) {
          const expectedDescription = `Module handling ${mod.name} functionality`;
          expect(mod.description).toBe(expectedDescription);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6 — Dependency graph edge completeness
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------

describe('Property 6a — Single import between two modules produces exactly one edge (Req 3.5)', () => {
  it('a single relative import from module A into module B produces one directed edge A→B', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Pick two distinct dir names
        fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{2,7}$/), {
          minLength: 2,
          maxLength: 2,
        }),
        async ([dirA, dirB]) => {
          // dirA/index.ts imports from dirB
          const importContent = `import { something } from '../${dirB}/service';`;
          const files = [
            makeFileEntry(`${dirA}/index.ts`, importContent, '.ts'),
            makeFileEntry(`${dirB}/index.ts`, '', '.ts'),
          ];
          const repo = makeRepo(files);
          const result = await analyzer.analyze(repo);

          const modules = result.modules ?? [];
          const edges = result.dependencyEdges ?? [];

          const modA = modules.find((m) => m.name === dirA);
          const modB = modules.find((m) => m.name === dirB);

          expect(modA).toBeDefined();
          expect(modB).toBeDefined();

          // Exactly one edge from A to B
          const edgesAtoB = edges.filter(
            (e) => e.from === modA!.id && e.to === modB!.id,
          );
          expect(edgesAtoB).toHaveLength(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 6b — Import chain A→B→C produces edges A→B and B→C (Req 3.5)', () => {
  it('a three-module chain has both required directed edges', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{2,7}$/), {
          minLength: 3,
          maxLength: 3,
        }),
        async ([dirA, dirB, dirC]) => {
          const files = [
            // A imports B
            makeFileEntry(
              `${dirA}/index.ts`,
              `import { b } from '../${dirB}/service';`,
              '.ts',
            ),
            // B imports C
            makeFileEntry(
              `${dirB}/index.ts`,
              `import { c } from '../${dirC}/service';`,
              '.ts',
            ),
            makeFileEntry(`${dirC}/index.ts`, '', '.ts'),
          ];
          const repo = makeRepo(files);
          const result = await analyzer.analyze(repo);

          const modules = result.modules ?? [];
          const edges = result.dependencyEdges ?? [];

          const modA = modules.find((m) => m.name === dirA);
          const modB = modules.find((m) => m.name === dirB);
          const modC = modules.find((m) => m.name === dirC);

          expect(modA).toBeDefined();
          expect(modB).toBeDefined();
          expect(modC).toBeDefined();

          const edgeAtoB = edges.filter(
            (e) => e.from === modA!.id && e.to === modB!.id,
          );
          const edgeBtoC = edges.filter(
            (e) => e.from === modB!.id && e.to === modC!.id,
          );

          expect(edgeAtoB).toHaveLength(1);
          expect(edgeBtoC).toHaveLength(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 6c — Edges have correct from/to module IDs matching module records (Req 3.5)', () => {
  it('every edge references valid module IDs that exist in the modules array', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-5 distinct dirs
        fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{2,7}$/), {
          minLength: 2,
          maxLength: 5,
        }),
        async (dirs) => {
          // Build files: each dir has an index.ts; first dir imports from the second
          const files: FileEntry[] = dirs.map((dir, i) => {
            const nextDir = dirs[(i + 1) % dirs.length];
            // Import next module (skip self-import by ensuring dirs are unique)
            const importLine =
              nextDir !== dir
                ? `import { x } from '../${nextDir}/service';`
                : '';
            return makeFileEntry(`${dir}/index.ts`, importLine, '.ts');
          });

          const repo = makeRepo(files);
          const result = await analyzer.analyze(repo);
          const modules = result.modules ?? [];
          const edges = result.dependencyEdges ?? [];

          const validIds = new Set(modules.map((m) => m.id));

          for (const edge of edges) {
            expect(validIds).toContain(edge.from);
            expect(validIds).toContain(edge.to);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 6d — No phantom edges for imports within the same module (Req 3.5)', () => {
  it('importing a file within the same top-level directory produces no inter-module edge', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{2,7}$/), {
          minLength: 1,
          maxLength: 4,
        }),
        async (dirs) => {
          // Each module's index.ts imports from a sibling file in the same directory
          const files = dirs.flatMap((dir) => [
            makeFileEntry(
              `${dir}/index.ts`,
              `import { helper } from './helper';`,
              '.ts',
            ),
            makeFileEntry(`${dir}/helper.ts`, 'export const helper = 1;', '.ts'),
          ]);

          const repo = makeRepo(files);
          const result = await analyzer.analyze(repo);
          const edges = result.dependencyEdges ?? [];

          // No edge should have from === to (self-edges are also invalid)
          for (const edge of edges) {
            expect(edge.from).not.toBe(edge.to);
          }

          // With only intra-module imports, total edges should be 0
          expect(edges).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 6e — No phantom edges for non-relative imports (Req 3.5)', () => {
  it('bare module specifiers like "express" produce no dependency edge', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{2,7}$/), {
          minLength: 1,
          maxLength: 4,
        }),
        async (dirs) => {
          // Each module only imports from npm packages (non-relative)
          const files = dirs.map((dir) =>
            makeFileEntry(
              `${dir}/index.ts`,
              `import express from 'express';\nimport { Injectable } from '@nestjs/common';`,
              '.ts',
            ),
          );

          const repo = makeRepo(files);
          const result = await analyzer.analyze(repo);
          const edges = result.dependencyEdges ?? [];

          // Non-relative imports must not generate any edge
          expect(edges).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
