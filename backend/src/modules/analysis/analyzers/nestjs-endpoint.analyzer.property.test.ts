// Feature: codebase-understanding-platform, Property 7

import * as fc from 'fast-check';
import { NestjsEndpointAnalyzer } from './nestjs-endpoint.analyzer';
import { RepositoryTree, FileEntry, Endpoint } from '../../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileEntry(
  relativePath: string,
  content: string,
  extension = '.ts',
): FileEntry {
  return { relativePath, content, extension };
}

function makeNestJsRepo(files: FileEntry[]): RepositoryTree {
  return {
    rootPath: '/',
    files,
    packageJson: {
      dependencies: {
        '@nestjs/common': '10.3.3',
        '@nestjs/core': '10.3.3',
      },
    },
  };
}

/**
 * Build a minimal NestJS controller source string with a single route.
 *
 * @param decoratorMethod - NestJS HTTP decorator name: 'Get' | 'Post' | 'Put' | 'Patch' | 'Delete'
 * @param controllerBase  - controller base path (e.g. 'api')
 * @param routePath       - route-level path (e.g. 'users')
 * @param handlerName     - method handler name (e.g. 'findAll')
 */
function buildControllerSource(
  decoratorMethod: string,
  controllerBase: string,
  routePath: string,
  handlerName: string,
): string {
  return [
    `import { Controller, ${decoratorMethod} } from '@nestjs/common';`,
    ``,
    `@Controller('${controllerBase}')`,
    `export class TestController {`,
    `  @${decoratorMethod}('${routePath}')`,
    `  ${handlerName}() {`,
    `    return [];`,
    `  }`,
    `}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** HTTP method decorator names supported by NestJS */
const HTTP_METHODS = ['Get', 'Post', 'Put', 'Patch', 'Delete'] as const;
type HttpDecoratorMethod = typeof HTTP_METHODS[number];

const arbHttpMethod = fc.constantFrom(...HTTP_METHODS);

/** Simple alphanumeric path segments (lowercase letters and digits, 1-10 chars) */
const arbPathSegment = fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/);

/** camelCase handler name: starts lowercase, 3-12 chars */
const arbHandlerName = fc
  .tuple(
    fc.stringMatching(/^[a-z]{1,6}$/),
    fc.stringMatching(/^[A-Z][a-z]{1,5}$/),
  )
  .map(([prefix, suffix]) => `${prefix}${suffix}`);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const analyzer = new NestjsEndpointAnalyzer();

// ---------------------------------------------------------------------------
// Property 7 — Route extraction and endpoint structure completeness
// Validates: Requirements 4.1, 4.2, 4.3
// ---------------------------------------------------------------------------

describe('Property 7a — Each generated NestJS route produces at least one Endpoint record (Req 4.1)', () => {
  it('a single-method controller always yields >= 1 endpoint', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbPathSegment,
        arbPathSegment,
        arbHandlerName,
        async (method, controllerBase, routePath, handlerName) => {
          const source = buildControllerSource(method, controllerBase, routePath, handlerName);
          const repo = makeNestJsRepo([
            makeFileEntry('src/test.controller.ts', source),
          ]);

          const result = await analyzer.analyze(repo);
          const endpoints = result.endpoints ?? [];

          expect(endpoints.length).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 7b — Endpoint id is always a non-empty string (Req 4.2)', () => {
  it('every endpoint has a non-empty string id', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbPathSegment,
        arbPathSegment,
        arbHandlerName,
        async (method, controllerBase, routePath, handlerName) => {
          const source = buildControllerSource(method, controllerBase, routePath, handlerName);
          const repo = makeNestJsRepo([
            makeFileEntry('src/test.controller.ts', source),
          ]);

          const result = await analyzer.analyze(repo);
          const endpoints = result.endpoints ?? [];

          for (const ep of endpoints) {
            expect(typeof ep.id).toBe('string');
            expect(ep.id.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 7c — Endpoint method matches the HTTP decorator (Req 4.1)', () => {
  it('extracted method equals the uppercased decorator name', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbPathSegment,
        arbPathSegment,
        arbHandlerName,
        async (decoratorMethod, controllerBase, routePath, handlerName) => {
          const source = buildControllerSource(decoratorMethod, controllerBase, routePath, handlerName);
          const repo = makeNestJsRepo([
            makeFileEntry('src/test.controller.ts', source),
          ]);

          const result = await analyzer.analyze(repo);
          const endpoints = result.endpoints ?? [];

          expect(endpoints.length).toBeGreaterThanOrEqual(1);
          const ep = endpoints[0];
          expect(ep.method).toBe(decoratorMethod.toUpperCase());
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 7d — Endpoint path always starts with "/" (Req 4.2)', () => {
  it('every endpoint path is a string starting with /', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbPathSegment,
        arbPathSegment,
        arbHandlerName,
        async (method, controllerBase, routePath, handlerName) => {
          const source = buildControllerSource(method, controllerBase, routePath, handlerName);
          const repo = makeNestJsRepo([
            makeFileEntry('src/test.controller.ts', source),
          ]);

          const result = await analyzer.analyze(repo);
          const endpoints = result.endpoints ?? [];

          for (const ep of endpoints) {
            expect(typeof ep.path).toBe('string');
            expect(ep.path.startsWith('/')).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 7e — Endpoint sourceFile is non-empty and matches the input file (Req 4.2)', () => {
  it('sourceFile is non-empty and equals the relativePath of the analyzed file', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbPathSegment,
        arbPathSegment,
        arbHandlerName,
        fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/),
        async (method, controllerBase, routePath, handlerName, filename) => {
          const relativePath = `src/${filename}.controller.ts`;
          const source = buildControllerSource(method, controllerBase, routePath, handlerName);
          const repo = makeNestJsRepo([
            makeFileEntry(relativePath, source),
          ]);

          const result = await analyzer.analyze(repo);
          const endpoints = result.endpoints ?? [];

          expect(endpoints.length).toBeGreaterThanOrEqual(1);
          for (const ep of endpoints) {
            expect(ep.sourceFile.length).toBeGreaterThan(0);
            expect(ep.sourceFile).toBe(relativePath);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 7f — Endpoint lineNumber is a positive integer (Req 4.3)', () => {
  it('lineNumber is a positive integer for every endpoint', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbPathSegment,
        arbPathSegment,
        arbHandlerName,
        async (method, controllerBase, routePath, handlerName) => {
          const source = buildControllerSource(method, controllerBase, routePath, handlerName);
          const repo = makeNestJsRepo([
            makeFileEntry('src/test.controller.ts', source),
          ]);

          const result = await analyzer.analyze(repo);
          const endpoints = result.endpoints ?? [];

          for (const ep of endpoints) {
            expect(Number.isInteger(ep.lineNumber)).toBe(true);
            expect(ep.lineNumber).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 7g — Endpoint middlewares is always an array (Req 4.2)', () => {
  it('middlewares field is always an array (possibly empty)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbPathSegment,
        arbPathSegment,
        arbHandlerName,
        async (method, controllerBase, routePath, handlerName) => {
          const source = buildControllerSource(method, controllerBase, routePath, handlerName);
          const repo = makeNestJsRepo([
            makeFileEntry('src/test.controller.ts', source),
          ]);

          const result = await analyzer.analyze(repo);
          const endpoints = result.endpoints ?? [];

          for (const ep of endpoints) {
            expect(Array.isArray(ep.middlewares)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 7h — serviceFunction and serviceFile fields are present (Req 4.3)', () => {
  it('both serviceFunction and serviceFile are present (can be null) on every endpoint', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbPathSegment,
        arbPathSegment,
        arbHandlerName,
        async (method, controllerBase, routePath, handlerName) => {
          const source = buildControllerSource(method, controllerBase, routePath, handlerName);
          const repo = makeNestJsRepo([
            makeFileEntry('src/test.controller.ts', source),
          ]);

          const result = await analyzer.analyze(repo);
          const endpoints = result.endpoints ?? [];

          for (const ep of endpoints) {
            // Fields must exist (even if null)
            expect('serviceFunction' in ep).toBe(true);
            expect('serviceFile' in ep).toBe(true);
            // Type check: string or null
            expect(ep.serviceFunction === null || typeof ep.serviceFunction === 'string').toBe(true);
            expect(ep.serviceFile === null || typeof ep.serviceFile === 'string').toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 7i — Path combination: base + route produces correct combined path (Req 4.2)', () => {
  it('combined path is /base/route for non-empty base and route segments', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbPathSegment,
        arbPathSegment,
        arbHandlerName,
        async (method, controllerBase, routePath, handlerName) => {
          const source = buildControllerSource(method, controllerBase, routePath, handlerName);
          const repo = makeNestJsRepo([
            makeFileEntry('src/test.controller.ts', source),
          ]);

          const result = await analyzer.analyze(repo);
          const endpoints = result.endpoints ?? [];

          expect(endpoints.length).toBeGreaterThanOrEqual(1);
          const ep = endpoints[0];

          const expectedPath = `/${controllerBase}/${routePath}`;
          expect(ep.path).toBe(expectedPath);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 7j — Empty repo returns empty endpoints array (Req 4.5)', () => {
  it('a repo with no source files returns an empty endpoints array', async () => {
    const repo: RepositoryTree = {
      rootPath: '/',
      files: [],
      packageJson: {
        dependencies: { '@nestjs/common': '10.3.3' },
      },
    };

    const result = await analyzer.analyze(repo);
    expect(result.endpoints).toBeDefined();
    expect(result.endpoints).toHaveLength(0);
  });
});

describe('Property 7k — detect() returns true for NestJS repos (Req 4.1)', () => {
  it('detect returns true when @nestjs/common is in dependencies', () => {
    const repo = makeNestJsRepo([]);
    expect(analyzer.detect(repo)).toBe(true);
  });

  it('detect returns false when no relevant framework is in dependencies', () => {
    const repo: RepositoryTree = {
      rootPath: '/',
      files: [],
      packageJson: { dependencies: { react: '18.0.0' } },
    };
    expect(analyzer.detect(repo)).toBe(false);
  });

  it('detect returns false for null packageJson', () => {
    const repo: RepositoryTree = {
      rootPath: '/',
      files: [],
      packageJson: null,
    };
    expect(analyzer.detect(repo)).toBe(false);
  });
});
