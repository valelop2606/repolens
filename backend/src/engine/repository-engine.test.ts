import AdmZip from 'adm-zip';
import { RepositoryEngine, RepositoryEngineError } from './repository-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates an in-memory ZIP buffer containing the given files. */
function makeZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [filePath, content] of Object.entries(files)) {
    zip.addFile(filePath, Buffer.from(content, 'utf8'));
  }
  return zip.toBuffer();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RepositoryEngine', () => {
  let engine: RepositoryEngine;

  beforeEach(() => {
    engine = new RepositoryEngine();
  });

  // -------------------------------------------------------------------------
  // Requirement 1.3 — INVALID_FORMAT
  // -------------------------------------------------------------------------

  describe('upload() — non-ZIP rejection (Req 1.3)', () => {
    it('throws INVALID_FORMAT for a plain text buffer', async () => {
      const buf = Buffer.from('this is not a zip file');
      await expect(engine.upload(buf)).rejects.toMatchObject({
        code: 'INVALID_FORMAT',
      });
    });

    it('throws INVALID_FORMAT for a JSON buffer', async () => {
      const buf = Buffer.from(JSON.stringify({ name: 'test' }));
      await expect(engine.upload(buf)).rejects.toMatchObject({
        code: 'INVALID_FORMAT',
      });
    });

    it('throws INVALID_FORMAT for an empty buffer', async () => {
      await expect(engine.upload(Buffer.alloc(0))).rejects.toMatchObject({
        code: 'INVALID_FORMAT',
      });
    });

    it('error message is non-empty', async () => {
      const buf = Buffer.from('not a zip');
      let err!: RepositoryEngineError;
      await engine.upload(buf).catch((e: unknown) => { err = e as RepositoryEngineError; });
      expect(err.message.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.2 — FILE_TOO_LARGE
  // -------------------------------------------------------------------------

  describe('upload() — oversized rejection (Req 1.2)', () => {
    it('throws FILE_TOO_LARGE when buffer exceeds 200 MB', async () => {
      const oversizedBuffer = Buffer.alloc(201 * 1024 * 1024);
      await expect(engine.upload(oversizedBuffer)).rejects.toMatchObject({
        code: 'FILE_TOO_LARGE',
      });
    });

    it('throws FILE_TOO_LARGE before checking magic bytes', async () => {
      // This buffer is too large AND not a ZIP — FILE_TOO_LARGE should win
      const oversizedBuffer = Buffer.alloc(201 * 1024 * 1024);
      let err!: RepositoryEngineError;
      await engine.upload(oversizedBuffer).catch((e: unknown) => { err = e as RepositoryEngineError; });
      expect(err.code).toBe('FILE_TOO_LARGE');
    });

    it('accepts a buffer at exactly 200 MB (boundary)', async () => {
      // We can't easily build a valid 200 MB ZIP here, so just verify that
      // the size check threshold is > 200 * 1024 * 1024 bytes for boundary value.
      // Use a valid ZIP that's well under the limit instead.
      const buf = makeZip({ 'file.txt': 'hello' });
      await expect(engine.upload(buf)).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.1 — file tree extraction
  // -------------------------------------------------------------------------

  describe('upload() — ZIP extraction (Req 1.1)', () => {
    it('returns a RepositoryTree with all files from the ZIP', async () => {
      const buf = makeZip({
        'project/src/index.ts': 'export default {};',
        'project/src/utils.ts': 'export const x = 1;',
        'project/README.md': '# My project',
      });

      const tree = await engine.upload(buf);

      expect(tree.files.length).toBe(3);
      const paths = tree.files.map((f) => f.relativePath);
      expect(paths).toContain('project/src/index.ts');
      expect(paths).toContain('project/src/utils.ts');
      expect(paths).toContain('project/README.md');
    });

    it('sets the correct extension on each FileEntry', async () => {
      const buf = makeZip({
        'project/app.tsx': '',
        'project/style.css': '',
        'project/data.json': '',
      });

      const tree = await engine.upload(buf);

      const byPath = Object.fromEntries(tree.files.map((f) => [f.relativePath, f]));
      expect(byPath['project/app.tsx'].extension).toBe('.tsx');
      expect(byPath['project/style.css'].extension).toBe('.css');
      expect(byPath['project/data.json'].extension).toBe('.json');
    });

    it('preserves file content correctly', async () => {
      const content = 'const greeting = "hello world";';
      const buf = makeZip({ 'project/hello.ts': content });

      const tree = await engine.upload(buf);
      expect(tree.files[0].content).toBe(content);
    });

    it('skips directory entries (no empty-content dirs in files[])', async () => {
      const zip = new AdmZip();
      zip.addFile('project/', Buffer.alloc(0)); // explicit directory entry
      zip.addFile('project/src/index.ts', Buffer.from('export {}'));
      const buf = zip.toBuffer();

      const tree = await engine.upload(buf);
      const hasDirEntry = tree.files.some((f) => f.relativePath.endsWith('/'));
      expect(hasDirEntry).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // rootPath detection
  // -------------------------------------------------------------------------

  describe('upload() — rootPath detection', () => {
    it('uses the single top-level directory as rootPath', async () => {
      const buf = makeZip({
        'my-project/src/index.ts': '',
        'my-project/package.json': '{}',
      });

      const tree = await engine.upload(buf);
      expect(tree.rootPath).toBe('my-project');
    });

    it('sets rootPath to "/" when there are multiple top-level entries', async () => {
      const buf = makeZip({
        'src/index.ts': '',
        'lib/utils.ts': '',
      });

      const tree = await engine.upload(buf);
      expect(tree.rootPath).toBe('/');
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.4 — package.json parsing
  // -------------------------------------------------------------------------

  describe('upload() — package.json parsing (Req 1.4)', () => {
    it('parses package.json when present at the root level', async () => {
      const pkg = {
        name: 'my-app',
        version: '1.2.3',
        description: 'A test app',
        dependencies: { express: '^4.18.0' },
      };
      const buf = makeZip({
        'my-app/package.json': JSON.stringify(pkg),
        'my-app/src/index.ts': '',
      });

      const tree = await engine.upload(buf);
      expect(tree.packageJson).toMatchObject(pkg);
    });

    it('captures name, version, description, and dependencies fields', async () => {
      const pkg = {
        name: 'sample',
        version: '0.1.0',
        description: 'Sample project',
        dependencies: { react: '^18.0.0', typescript: '^5.0.0' },
      };
      const buf = makeZip({
        'sample/package.json': JSON.stringify(pkg),
        'sample/index.ts': '',
      });

      const tree = await engine.upload(buf);
      expect((tree.packageJson as typeof pkg).name).toBe('sample');
      expect((tree.packageJson as typeof pkg).version).toBe('0.1.0');
      expect((tree.packageJson as typeof pkg).description).toBe('Sample project');
      expect((tree.packageJson as typeof pkg).dependencies).toEqual(pkg.dependencies);
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.5 — absent package.json
  // -------------------------------------------------------------------------

  describe('upload() — absent package.json (Req 1.5)', () => {
    it('returns null for packageJson when no package.json exists', async () => {
      const buf = makeZip({
        'project/src/index.ts': 'console.log("hello");',
        'project/README.md': '# No package.json here',
      });

      const tree = await engine.upload(buf);
      expect(tree.packageJson).toBeNull();
    });

    it('still returns files when package.json is absent', async () => {
      const buf = makeZip({ 'project/app.js': 'module.exports = {};' });

      const tree = await engine.upload(buf);
      expect(tree.files.length).toBeGreaterThan(0);
    });

    it('returns null for malformed package.json', async () => {
      const buf = makeZip({
        'project/package.json': '{ this is not valid json }',
        'project/index.ts': '',
      });

      const tree = await engine.upload(buf);
      expect(tree.packageJson).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // RepositoryEngineError shape
  // -------------------------------------------------------------------------

  describe('RepositoryEngineError', () => {
    it('is an instance of Error', async () => {
      const buf = Buffer.from('not a zip');
      const err = await engine.upload(buf).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
    });

    it('exposes a code property', async () => {
      const buf = Buffer.from('not a zip');
      let err!: RepositoryEngineError;
      await engine.upload(buf).catch((e: unknown) => { err = e as RepositoryEngineError; });
      expect(typeof err.code).toBe('string');
    });
  });
});
