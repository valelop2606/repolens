// Feature: codebase-understanding-platform, Property 1, 2, 3

import * as fc from 'fast-check';
import AdmZip from 'adm-zip';
import { RepositoryEngine, RepositoryEngineError } from '../repository-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds an in-memory ZIP buffer from a map of { filePath -> content }.
 */
function buildZipBuffer(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [filePath, content] of Object.entries(files)) {
    zip.addFile(filePath, Buffer.from(content, 'utf8'));
  }
  return zip.toBuffer();
}

/**
 * Generates a safe relative file path (no special chars that break adm-zip).
 * Examples: "src/index.ts", "lib/utils/helpers.js"
 */
const arbSafeFileName = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
    fc.constantFrom('.ts', '.js', '.tsx', '.json', '.md', '.css'),
  )
  .map(([dir, name, ext]) => `${dir}/${name}${ext}`);

/**
 * Generates a non-empty record of { filePath -> content } suitable for a ZIP.
 * Ensures at least 1 entry and at most 5 to keep tests fast.
 * Paths are deduplicated to avoid adm-zip conflicts.
 */
const arbFileMap = fc
  .uniqueArray(arbSafeFileName, { minLength: 1, maxLength: 5 })
  .chain((paths) =>
    fc
      .array(fc.string({ maxLength: 200 }), {
        minLength: paths.length,
        maxLength: paths.length,
      })
      .map((contents) => {
        const map: Record<string, string> = {};
        for (let i = 0; i < paths.length; i++) {
          map[paths[i]] = contents[i];
        }
        return map;
      }),
  );

/**
 * Generates a Buffer whose first 4 bytes are guaranteed NOT to be the ZIP
 * magic bytes (0x50 0x4B 0x03 0x04).  The buffer length is at least 4.
 */
const arbNonZipBuffer = fc
  .uint8Array({ minLength: 4, maxLength: 256 })
  .filter(
    (arr) =>
      !(arr[0] === 0x50 && arr[1] === 0x4b && arr[2] === 0x03 && arr[3] === 0x04),
  )
  .map((arr) => Buffer.from(arr));

/**
 * Generates a valid npm package name (lowercase letters and hyphens only).
 */
const arbPackageName = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/);

/**
 * Generates a semver-like version string: "0.0.0" to "9.99.99".
 */
const arbVersion = fc
  .tuple(
    fc.integer({ min: 0, max: 9 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

/**
 * Generates a record of dependency name -> version strings.
 * May be empty or contain up to 5 entries.
 */
const arbDependencies = fc
  .uniqueArray(arbPackageName, { minLength: 0, maxLength: 5 })
  .chain((names) =>
    fc
      .array(arbVersion, { minLength: names.length, maxLength: names.length })
      .map((versions) => {
        const deps: Record<string, string> = {};
        for (let i = 0; i < names.length; i++) {
          deps[names[i]] = versions[i];
        }
        return deps;
      }),
  );

/**
 * Generates a complete package.json object with the four fields we care about.
 */
const arbPackageJson = fc.record({
  name: arbPackageName,
  version: arbVersion,
  description: fc.string({ maxLength: 100 }),
  dependencies: arbDependencies,
});

// ---------------------------------------------------------------------------
// Property 1: Valid ZIP file tree extraction
// Validates: Requirements 1.1
// ---------------------------------------------------------------------------

describe('Property 1 — Valid ZIP file tree extraction (Req 1.1)', () => {
  // Feature: codebase-understanding-platform, Property 1: Valid ZIP file tree extraction

  it('files[] contains an entry for every file in the ZIP', async () => {
    const engine = new RepositoryEngine();

    await fc.assert(
      fc.asyncProperty(arbFileMap, async (fileMap) => {
        const zipBuffer = buildZipBuffer(fileMap);
        const tree = await engine.upload(zipBuffer);

        // The files array must be non-empty
        expect(tree.files.length).toBeGreaterThan(0);

        // Every path we put in must appear in the returned files
        const returnedPaths = new Set(tree.files.map((f) => f.relativePath));
        for (const filePath of Object.keys(fileMap)) {
          expect(returnedPaths.has(filePath)).toBe(true);
        }

        // The count must match (no extra phantom entries)
        expect(tree.files.length).toBe(Object.keys(fileMap).length);
      }),
      { numRuns: 100 },
    );
  });

  it('each FileEntry has a non-empty relativePath and a valid extension', async () => {
    const engine = new RepositoryEngine();

    await fc.assert(
      fc.asyncProperty(arbFileMap, async (fileMap) => {
        const zipBuffer = buildZipBuffer(fileMap);
        const tree = await engine.upload(zipBuffer);

        for (const entry of tree.files) {
          expect(entry.relativePath.length).toBeGreaterThan(0);
          expect(entry.extension).toMatch(/^\.[a-z]+$/i);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Non-ZIP input rejection
// Validates: Requirements 1.3
// ---------------------------------------------------------------------------

describe('Property 2 — Non-ZIP input rejection (Req 1.3)', () => {
  // Feature: codebase-understanding-platform, Property 2: Non-ZIP input rejection

  it('throws an error for any buffer without ZIP magic bytes', async () => {
    const engine = new RepositoryEngine();

    await fc.assert(
      fc.asyncProperty(arbNonZipBuffer, async (nonZipBuf) => {
        let threw = false;
        let error: unknown;

        await engine.upload(nonZipBuf).catch((e: unknown) => {
          threw = true;
          error = e;
        });

        expect(threw).toBe(true);
        expect(error).toBeInstanceOf(Error);
      }),
      { numRuns: 100 },
    );
  });

  it('error code is INVALID_FORMAT for non-ZIP buffers', async () => {
    const engine = new RepositoryEngine();

    await fc.assert(
      fc.asyncProperty(arbNonZipBuffer, async (nonZipBuf) => {
        const err = await engine.upload(nonZipBuf).catch((e) => e) as RepositoryEngineError;
        // Could also be FILE_TOO_LARGE if the buffer is large, but our generator
        // caps at 256 bytes so it is well under the 200 MB limit.
        expect(err.code).toBe('INVALID_FORMAT');
      }),
      { numRuns: 100 },
    );
  });

  it('error message is non-empty for every non-ZIP buffer', async () => {
    const engine = new RepositoryEngine();

    await fc.assert(
      fc.asyncProperty(arbNonZipBuffer, async (nonZipBuf) => {
        const err = await engine.upload(nonZipBuf).catch((e) => e) as RepositoryEngineError;
        expect(typeof err.message).toBe('string');
        expect(err.message.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: package.json round-trip
// Validates: Requirements 1.4
// ---------------------------------------------------------------------------

describe('Property 3 — package.json round-trip (Req 1.4)', () => {
  // Feature: codebase-understanding-platform, Property 3: package.json field extraction round-trip

  it('name, version, description, and dependencies survive the round-trip', async () => {
    const engine = new RepositoryEngine();

    await fc.assert(
      fc.asyncProperty(arbPackageJson, async (pkg) => {
        // Place the package.json inside a single root dir alongside a source file
        const fileMap: Record<string, string> = {
          'project/package.json': JSON.stringify(pkg),
          'project/src/index.ts': 'export {};',
        };
        const zipBuffer = buildZipBuffer(fileMap);
        const tree = await engine.upload(zipBuffer);

        // packageJson must be parsed and non-null
        expect(tree.packageJson).not.toBeNull();

        const parsed = tree.packageJson as typeof pkg;

        expect(parsed.name).toBe(pkg.name);
        expect(parsed.version).toBe(pkg.version);
        expect(parsed.description).toBe(pkg.description);
        expect(parsed.dependencies).toEqual(pkg.dependencies);
      }),
      { numRuns: 100 },
    );
  });

  it('packageJson field values match the originals for arbitrary dependency maps', async () => {
    const engine = new RepositoryEngine();

    // Focus solely on the dependencies field with larger random maps
    const arbLargeDeps = fc
      .uniqueArray(arbPackageName, { minLength: 0, maxLength: 20 })
      .chain((names) =>
        fc
          .array(arbVersion, { minLength: names.length, maxLength: names.length })
          .map((versions) => {
            const deps: Record<string, string> = {};
            for (let i = 0; i < names.length; i++) {
              deps[names[i]] = versions[i];
            }
            return deps;
          }),
      );

    await fc.assert(
      fc.asyncProperty(arbLargeDeps, async (deps) => {
        const pkg = {
          name: 'test-app',
          version: '1.0.0',
          description: 'round-trip test',
          dependencies: deps,
        };
        const fileMap: Record<string, string> = {
          'project/package.json': JSON.stringify(pkg),
          'project/index.ts': '',
        };
        const zipBuffer = buildZipBuffer(fileMap);
        const tree = await engine.upload(zipBuffer);

        expect(tree.packageJson).not.toBeNull();
        const parsed = tree.packageJson as typeof pkg;
        expect(parsed.dependencies).toEqual(deps);
      }),
      { numRuns: 100 },
    );
  });
});
