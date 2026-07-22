// Feature: codebase-understanding-platform, Property 19, 20

import * as fc from 'fast-check';
import { AnalysisEngine } from './analysis-engine';
import { Analyzer } from '../analyzers/analyzer.interface';
import { RepositoryTree, PartialAnalysisResult } from '../types/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal RepositoryTree used as input for all tests. */
const EMPTY_REPO: RepositoryTree = {
  rootPath: '/repo',
  files: [],
  packageJson: null,
};

/**
 * Builds a mock Analyzer that:
 * - detect()  → always returns true
 * - analyze() → returns a unique PartialAnalysisResult and increments a counter
 */
function buildDetectingAnalyzer(name: string): Analyzer & { callCount: number } {
  const mock = {
    name,
    callCount: 0,
    detect(_repo: RepositoryTree): boolean {
      return true;
    },
    async analyze(_repo: RepositoryTree): Promise<PartialAnalysisResult> {
      mock.callCount++;
      return { technologies: [{ name, confidence: 'high', detectedBy: 'mock' }] };
    },
  };
  return mock;
}

/**
 * Builds a mock Analyzer that:
 * - detect()  → always returns false (skip)
 * - analyze() → tracks calls (should never be called)
 */
function buildSkippingAnalyzer(name: string): Analyzer & { analyzeCallCount: number } {
  const mock = {
    name,
    analyzeCallCount: 0,
    detect(_repo: RepositoryTree): boolean {
      return false;
    },
    async analyze(_repo: RepositoryTree): Promise<PartialAnalysisResult> {
      mock.analyzeCallCount++;
      return {};
    },
  };
  return mock;
}

/**
 * Builds a mock Analyzer that:
 * - detect()  → always returns true
 * - analyze() → throws with the given error message
 */
function buildThrowingAnalyzer(name: string, errorMsg: string): Analyzer {
  return {
    name,
    detect(_repo: RepositoryTree): boolean {
      return true;
    },
    async analyze(_repo: RepositoryTree): Promise<PartialAnalysisResult> {
      throw new Error(errorMsg);
    },
  };
}

/**
 * Builds a valid (detecting + succeeding) analyzer that returns a known result.
 * Returns the result via a closure so we can compare it in assertions.
 */
function buildValidAnalyzer(name: string): { analyzer: Analyzer; result: PartialAnalysisResult } {
  const result: PartialAnalysisResult = {
    technologies: [{ name, confidence: 'high', detectedBy: 'mock' }],
  };
  const analyzer: Analyzer = {
    name,
    detect(_repo: RepositoryTree): boolean {
      return true;
    },
    async analyze(_repo: RepositoryTree): Promise<PartialAnalysisResult> {
      return result;
    },
  };
  return { analyzer, result };
}

// ---------------------------------------------------------------------------
// Arbitrary: safe analyzer name (no duplicates enforced at generator level)
// ---------------------------------------------------------------------------

const arbAnalyzerName = fc.stringMatching(/^[a-z][a-z0-9]{0,12}$/);

// ---------------------------------------------------------------------------
// Property 19: Analyzer invocation coverage
// Validates: Requirements 14.1, 14.2
// ---------------------------------------------------------------------------

describe('Property 19 — Analyzer invocation coverage (Req 14.1, 14.2)', () => {
  // Feature: codebase-understanding-platform, Property 19: Analyzer invocation coverage

  it('analyze() is called exactly once for each detecting analyzer', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1–8 unique analyzer names
        fc.uniqueArray(arbAnalyzerName, { minLength: 1, maxLength: 8 }),
        async (names) => {
          const mocks = names.map((n) => buildDetectingAnalyzer(n));
          const engine = new AnalysisEngine(mocks);
          await engine.run(EMPTY_REPO);

          for (const mock of mocks) {
            expect(mock.callCount).toBe(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('run() returns one result per detecting analyzer', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(arbAnalyzerName, { minLength: 1, maxLength: 8 }),
        async (names) => {
          const mocks = names.map((n) => buildDetectingAnalyzer(n));
          const engine = new AnalysisEngine(mocks);
          const results = await engine.run(EMPTY_REPO);

          // Each analyzer produces exactly one result
          expect(results.length).toBe(names.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty analyzer array produces an empty results array', async () => {
    const engine = new AnalysisEngine([]);
    const results = await engine.run(EMPTY_REPO);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Property 20: Analyzer skip and fault isolation
// Validates: Requirements 14.4, 14.5
// ---------------------------------------------------------------------------

describe('Property 20 — Analyzer skip and fault isolation (Req 14.4, 14.5)', () => {
  // Feature: codebase-understanding-platform, Property 20: Analyzer skip and fault isolation

  it('(a) analyze() is never called on skipped analyzers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(arbAnalyzerName, { minLength: 1, maxLength: 6 }),
        async (names) => {
          const skippers = names.map((n) => buildSkippingAnalyzer(n));
          const engine = new AnalysisEngine(skippers);
          await engine.run(EMPTY_REPO);

          for (const mock of skippers) {
            expect(mock.analyzeCallCount).toBe(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(b) a warning is recorded for each throwing analyzer', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1–5 unique names for throwing analyzers
        fc.uniqueArray(arbAnalyzerName, { minLength: 1, maxLength: 5 }),
        async (names) => {
          const throwers = names.map((n) => buildThrowingAnalyzer(n, `${n} exploded`));
          const engine = new AnalysisEngine(throwers);
          const results = await engine.run(EMPTY_REPO);

          // Each throwing analyzer produces one result with a warnings entry
          expect(results.length).toBe(names.length);

          for (const result of results) {
            expect(result.warnings).toBeDefined();
            expect(result.warnings!.length).toBeGreaterThan(0);
            const warning = result.warnings![0];
            expect(warning.code).toBe('ANALYZER_ERROR');
            expect(typeof warning.message).toBe('string');
            expect(warning.message.length).toBeGreaterThan(0);
            expect(warning.severity).toBe('warning');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(c) results from non-throwing, non-skipped analyzers are returned', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(arbAnalyzerName, { minLength: 1, maxLength: 5 }),
        async (names) => {
          const validPairs = names.map((n) => buildValidAnalyzer(n));
          const engine = new AnalysisEngine(validPairs.map((p) => p.analyzer));
          const results = await engine.run(EMPTY_REPO);

          expect(results.length).toBe(names.length);

          // Each result must match what the corresponding analyzer returned
          for (let i = 0; i < validPairs.length; i++) {
            expect(results[i]).toEqual(validPairs[i].result);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('mixed set: skipped/throwing/valid analyzers behave correctly together', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Counts for each kind: 0–3 each (at least 1 total via filtering)
        fc.record({
          validCount:   fc.integer({ min: 0, max: 3 }),
          skipCount:    fc.integer({ min: 0, max: 3 }),
          throwCount:   fc.integer({ min: 0, max: 3 }),
        }).filter(({ validCount, skipCount, throwCount }) =>
          validCount + skipCount + throwCount >= 1,
        ),
        async ({ validCount, skipCount, throwCount }) => {
          // Build unique names per group so there are no collisions
          const validNames   = Array.from({ length: validCount },  (_, i) => `valid${i}`);
          const skipNames    = Array.from({ length: skipCount },   (_, i) => `skip${i}`);
          const throwNames   = Array.from({ length: throwCount },  (_, i) => `throw${i}`);

          const skippers  = skipNames.map((n) => buildSkippingAnalyzer(n));
          const throwers  = throwNames.map((n) => buildThrowingAnalyzer(n, `${n} failed`));
          const valids    = validNames.map((n) => buildValidAnalyzer(n));

          // Interleave all three types
          const allAnalyzers: Analyzer[] = [
            ...skippers,
            ...throwers,
            ...valids.map((v) => v.analyzer),
          ];

          const engine = new AnalysisEngine(allAnalyzers);
          const results = await engine.run(EMPTY_REPO);

          // (a) skipped analyzers: analyze() never called
          for (const s of skippers) {
            expect(s.analyzeCallCount).toBe(0);
          }

          // (b) throwing analyzers each contribute a warning result
          const warningResults = results.filter(
            (r) => r.warnings && r.warnings.some((w) => w.code === 'ANALYZER_ERROR'),
          );
          expect(warningResults.length).toBe(throwCount);

          // (c) valid analyzers each produce a non-warning result
          const successResults = results.filter(
            (r) => !r.warnings || !r.warnings.some((w) => w.code === 'ANALYZER_ERROR'),
          );
          expect(successResults.length).toBe(validCount);

          // Total results = throwing + valid (skipped produce nothing)
          expect(results.length).toBe(throwCount + validCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});
