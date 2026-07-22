// Feature: codebase-understanding-platform, Property 4

import * as fc from 'fast-check';
import { TechDetectionAnalyzer } from './tech-detection.analyzer';
import { RepositoryTree } from '../../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(options: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  files?: Array<{ relativePath: string; extension: string }>;
}): RepositoryTree {
  return {
    rootPath: '/',
    files: (options.files ?? []).map((f) => ({
      relativePath: f.relativePath,
      content: '',
      extension: f.extension,
    })),
    packageJson:
      options.dependencies || options.devDependencies
        ? {
            dependencies: options.dependencies ?? {},
            devDependencies: options.devDependencies ?? {},
          }
        : null,
  };
}

// Full dep→tech mapping mirrored from the implementation so tests are
// self-contained and don't rely on internals.
const KNOWN_DEPS: Array<[string, string]> = [
  ['react', 'React'],
  ['react-dom', 'React DOM'],
  ['react-router-dom', 'React Router'],
  ['@nestjs/core', 'NestJS'],
  ['@nestjs/common', 'NestJS'],
  ['express', 'Express'],
  ['fastify', 'Fastify'],
  ['mongoose', 'Mongoose'],
  ['@nestjs/mongoose', 'Mongoose'],
  ['sequelize', 'Sequelize'],
  ['typeorm', 'TypeORM'],
  ['prisma', 'Prisma'],
  ['axios', 'Axios'],
  ['rxjs', 'RxJS'],
  ['@aws-sdk/client-bedrock-runtime', 'AWS Bedrock'],
  ['@aws-sdk/client-s3', 'AWS S3'],
  ['vite', 'Vite'],
  ['webpack', 'Webpack'],
  ['jest', 'Jest'],
  ['typescript', 'TypeScript'],
];

/** Returns the de-duplicated set of tech names expected for a given dep list. */
function expectedTechNames(deps: string[]): Set<string> {
  const seen = new Set<string>();
  const result = new Set<string>();
  for (const [dep, tech] of KNOWN_DEPS) {
    if (deps.includes(dep) && !seen.has(tech)) {
      seen.add(tech);
      result.add(tech);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Picks a random non-empty subset of the known dep keys. */
const arbDepSubset = fc
  .uniqueArray(fc.integer({ min: 0, max: KNOWN_DEPS.length - 1 }), {
    minLength: 1,
    maxLength: KNOWN_DEPS.length,
  })
  .map((indices) => indices.map((i) => KNOWN_DEPS[i][0]));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const analyzer = new TechDetectionAnalyzer();

// ---------------------------------------------------------------------------
// Property 4a — Dependency detection
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------

describe('Property 4a — Dependency detection (Req 2.1, 2.2)', () => {
  it('all expected tech names appear for any random subset of known deps', async () => {
    await fc.assert(
      fc.asyncProperty(arbDepSubset, async (deps) => {
        const depsRecord = Object.fromEntries(deps.map((d) => [d, '1.0.0']));
        const repo = makeRepo({ dependencies: depsRecord });
        const result = await analyzer.analyze(repo);
        const techs = result.technologies ?? [];

        const expected = expectedTechNames(deps);
        const detectedNames = new Set(techs.map((t) => t.name));

        // Every expected tech name must be present
        for (const name of expected) {
          expect(detectedNames).toContain(name);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('every dependency-detected entry has non-empty name, confidence "high", and correct detectedBy prefix', async () => {
    await fc.assert(
      fc.asyncProperty(arbDepSubset, async (deps) => {
        const depsRecord = Object.fromEntries(deps.map((d) => [d, '1.0.0']));
        const repo = makeRepo({ dependencies: depsRecord });
        const result = await analyzer.analyze(repo);
        const techs = result.technologies ?? [];

        for (const tech of techs) {
          expect(tech.name.length).toBeGreaterThan(0);
          expect(tech.confidence).toBe('high');
          expect(tech.detectedBy).toMatch(/^package\.json dependency:/);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('devDependencies are also detected with confidence "high"', async () => {
    await fc.assert(
      fc.asyncProperty(arbDepSubset, async (deps) => {
        const devDepsRecord = Object.fromEntries(deps.map((d) => [d, '1.0.0']));
        const repo = makeRepo({ devDependencies: devDepsRecord });
        const result = await analyzer.analyze(repo);
        const techs = result.technologies ?? [];

        const expected = expectedTechNames(deps);
        const detectedNames = new Set(techs.map((t) => t.name));

        for (const name of expected) {
          expect(detectedNames).toContain(name);
        }

        // All entries must still be "high" confidence
        for (const tech of techs) {
          expect(tech.confidence).toBe('high');
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4b — File extension detection
// Validates: Requirements 2.3
// ---------------------------------------------------------------------------

describe('Property 4b — File extension detection (Req 2.3)', () => {
  const EXT_MAP: Array<[string, string, string]> = [
    ['.ts', 'TypeScript', 'file extension .ts/.tsx'],
    ['.tsx', 'TypeScript', 'file extension .ts/.tsx'],
    ['.tsx', 'React', 'file extension .tsx'],
    ['.py', 'Python', 'file extension .py'],
    ['.java', 'Java', 'file extension .java'],
  ];

  it('TypeScript is detected when .ts files exist (no deps)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (count) => {
          const files = Array.from({ length: count }, (_, i) => ({
            relativePath: `file${i}.ts`,
            extension: '.ts',
          }));
          const repo = makeRepo({ files });
          const result = await analyzer.analyze(repo);
          const techs = result.technologies ?? [];
          const names = techs.map((t) => t.name);

          expect(names).toContain('TypeScript');
          const ts = techs.find((t) => t.name === 'TypeScript')!;
          expect(ts.confidence).toBe('medium');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('TypeScript AND React are detected when .tsx files exist (no deps)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (count) => {
          const files = Array.from({ length: count }, (_, i) => ({
            relativePath: `Component${i}.tsx`,
            extension: '.tsx',
          }));
          const repo = makeRepo({ files });
          const result = await analyzer.analyze(repo);
          const techs = result.technologies ?? [];
          const names = techs.map((t) => t.name);

          expect(names).toContain('TypeScript');
          expect(names).toContain('React');

          for (const tech of techs) {
            expect(tech.confidence).toBe('medium');
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('Python is detected when .py files exist (no deps)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (count) => {
          const files = Array.from({ length: count }, (_, i) => ({
            relativePath: `script${i}.py`,
            extension: '.py',
          }));
          const repo = makeRepo({ files });
          const result = await analyzer.analyze(repo);
          const techs = result.technologies ?? [];
          const names = techs.map((t) => t.name);

          expect(names).toContain('Python');
          const py = techs.find((t) => t.name === 'Python')!;
          expect(py.confidence).toBe('medium');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('Java is detected when .java files exist (no deps)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (count) => {
          const files = Array.from({ length: count }, (_, i) => ({
            relativePath: `Main${i}.java`,
            extension: '.java',
          }));
          const repo = makeRepo({ files });
          const result = await analyzer.analyze(repo);
          const techs = result.technologies ?? [];
          const names = techs.map((t) => t.name);

          expect(names).toContain('Java');
          const java = techs.find((t) => t.name === 'Java')!;
          expect(java.confidence).toBe('medium');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('no extension-based entry is produced when extensions are absent', async () => {
    const repo = makeRepo({ files: [{ relativePath: 'README.md', extension: '.md' }] });
    const result = await analyzer.analyze(repo);
    const techs = result.technologies ?? [];
    const names = new Set(techs.map((t) => t.name));

    // None of the extension-detected techs should appear
    expect(names).not.toContain('TypeScript');
    expect(names).not.toContain('Python');
    expect(names).not.toContain('Java');
  });
});

// ---------------------------------------------------------------------------
// Property 4c — Config file detection
// Validates: Requirements 2.4
// ---------------------------------------------------------------------------

describe('Property 4c — Config file detection (Req 2.4)', () => {
  const CONFIG_MAP: Array<[string, string]> = [
    ['tsconfig.json', 'TypeScript'],
    ['vite.config.ts', 'Vite'],
    ['nest-cli.json', 'NestJS'],
  ];

  it.each(CONFIG_MAP)(
    'config file %s produces a medium-confidence %s entry (no matching deps)',
    async (filename, expectedTech) => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(filename),
          async (cfgFile) => {
            const repo = makeRepo({
              files: [{ relativePath: cfgFile, extension: `.${cfgFile.split('.').pop()}` }],
            });
            const result = await analyzer.analyze(repo);
            const techs = result.technologies ?? [];
            const entry = techs.find((t) => t.name === expectedTech);

            expect(entry).toBeDefined();
            expect(entry!.confidence).toBe('medium');
          },
        ),
        { numRuns: 10 },
      );
    },
  );

  it('all three config files together yield TypeScript, Vite, and NestJS at medium confidence', async () => {
    const repo = makeRepo({
      files: [
        { relativePath: 'tsconfig.json', extension: '.json' },
        { relativePath: 'vite.config.ts', extension: '.ts' },
        { relativePath: 'nest-cli.json', extension: '.json' },
      ],
    });
    // No matching deps — use empty packageJson so config detection is exercised
    const result = await analyzer.analyze(repo);
    const techs = result.technologies ?? [];
    const names = new Set(techs.map((t) => t.name));

    // vite.config.ts also has .ts extension → TypeScript via extension (medium)
    expect(names).toContain('TypeScript');
    expect(names).toContain('Vite');
    expect(names).toContain('NestJS');

    for (const tech of techs) {
      expect(tech.confidence).toBe('medium');
    }
  });
});

// ---------------------------------------------------------------------------
// Property 4d — Deduplication
// Validates: Requirements 2.5
// ---------------------------------------------------------------------------

describe('Property 4d — Deduplication (Req 2.5)', () => {
  it('technologies array never contains duplicate names for any random repo config', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          deps: arbDepSubset,
          hasTs: fc.boolean(),
          hasTsx: fc.boolean(),
          hasPy: fc.boolean(),
          hasJava: fc.boolean(),
        }),
        async ({ deps, hasTs, hasTsx, hasPy, hasJava }) => {
          const depsRecord = Object.fromEntries(deps.map((d) => [d, '1.0.0']));
          const files: Array<{ relativePath: string; extension: string }> = [];
          if (hasTs) files.push({ relativePath: 'index.ts', extension: '.ts' });
          if (hasTsx) files.push({ relativePath: 'App.tsx', extension: '.tsx' });
          if (hasPy) files.push({ relativePath: 'main.py', extension: '.py' });
          if (hasJava) files.push({ relativePath: 'Main.java', extension: '.java' });

          const repo = makeRepo({ dependencies: depsRecord, files });
          const result = await analyzer.analyze(repo);
          const techs = result.technologies ?? [];

          const names = techs.map((t) => t.name);
          const unique = new Set(names);

          expect(names.length).toBe(unique.size);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('NestJS appears exactly once when both @nestjs/core and @nestjs/common are present', async () => {
    const repo = makeRepo({
      dependencies: {
        '@nestjs/core': '10.0.0',
        '@nestjs/common': '10.0.0',
      },
    });
    const result = await analyzer.analyze(repo);
    const techs = result.technologies ?? [];
    const nestEntries = techs.filter((t) => t.name === 'NestJS');
    expect(nestEntries).toHaveLength(1);
  });

  it('Mongoose appears exactly once when both mongoose and @nestjs/mongoose are present', async () => {
    const repo = makeRepo({
      dependencies: {
        mongoose: '8.0.0',
        '@nestjs/mongoose': '10.0.0',
      },
    });
    const result = await analyzer.analyze(repo);
    const techs = result.technologies ?? [];
    const mongooseEntries = techs.filter((t) => t.name === 'Mongoose');
    expect(mongooseEntries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Property 4e — AWS first-class detection
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------

describe('Property 4e — AWS first-class detection (Req 2.1, 2.2)', () => {
  it('@aws-sdk/client-bedrock-runtime maps to "AWS Bedrock" with confidence "high"', async () => {
    const repo = makeRepo({
      dependencies: { '@aws-sdk/client-bedrock-runtime': '3.540.0' },
    });
    const result = await analyzer.analyze(repo);
    const techs = result.technologies ?? [];
    const entry = techs.find((t) => t.name === 'AWS Bedrock');

    expect(entry).toBeDefined();
    expect(entry!.confidence).toBe('high');
    expect(entry!.detectedBy).toBe('package.json dependency: @aws-sdk/client-bedrock-runtime');
  });

  it('@aws-sdk/client-s3 maps to "AWS S3" with confidence "high"', async () => {
    const repo = makeRepo({
      dependencies: { '@aws-sdk/client-s3': '3.540.0' },
    });
    const result = await analyzer.analyze(repo);
    const techs = result.technologies ?? [];
    const entry = techs.find((t) => t.name === 'AWS S3');

    expect(entry).toBeDefined();
    expect(entry!.confidence).toBe('high');
    expect(entry!.detectedBy).toBe('package.json dependency: @aws-sdk/client-s3');
  });

  it('both AWS Bedrock and AWS S3 are detected independently when both deps are present', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant({
          '@aws-sdk/client-bedrock-runtime': '3.540.0',
          '@aws-sdk/client-s3': '3.540.0',
        }),
        async (awsDeps) => {
          const repo = makeRepo({ dependencies: awsDeps });
          const result = await analyzer.analyze(repo);
          const techs = result.technologies ?? [];
          const names = new Set(techs.map((t) => t.name));

          expect(names).toContain('AWS Bedrock');
          expect(names).toContain('AWS S3');

          const bedrock = techs.find((t) => t.name === 'AWS Bedrock')!;
          const s3 = techs.find((t) => t.name === 'AWS S3')!;

          expect(bedrock.confidence).toBe('high');
          expect(s3.confidence).toBe('high');
        },
      ),
      { numRuns: 10 },
    );
  });
});
