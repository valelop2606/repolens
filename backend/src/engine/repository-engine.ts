import AdmZip from 'adm-zip';
import path from 'path';
import { FileEntry, RepositoryTree } from '../types';

// ZIP magic bytes: PK\x03\x04
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// 200 MB in bytes
const MAX_FILE_SIZE = 200 * 1024 * 1024;

export class RepositoryEngineError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RepositoryEngineError';
    this.code = code;
  }
}

export class RepositoryEngine {
  /**
   * Accepts a ZIP buffer, validates it, extracts its contents, and returns
   * a RepositoryTree describing the complete file tree and parsed package.json.
   */
  async upload(zipBuffer: Buffer): Promise<RepositoryTree> {
    // Requirement 1.2 — reject oversized uploads
    if (zipBuffer.length > MAX_FILE_SIZE) {
      throw new RepositoryEngineError(
        'FILE_TOO_LARGE',
        `Uploaded file exceeds the 200 MB size limit (received ${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB).`,
      );
    }

    // Requirement 1.3 — reject non-ZIP files by checking magic bytes
    if (!this._isZip(zipBuffer)) {
      throw new RepositoryEngineError(
        'INVALID_FORMAT',
        'Uploaded file is not a valid ZIP archive. Please upload a .zip file.',
      );
    }

    // Extract ZIP contents
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      throw new RepositoryEngineError(
        'EXTRACTION_FAILED',
        'Failed to open the ZIP archive. The file may be corrupt.',
      );
    }

    const entries = zip.getEntries();

    // Requirement 1.1 — build FileEntry[] from all extracted paths and contents
    const files: FileEntry[] = [];
    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const relativePath = entry.entryName;
      let content: string;
      try {
        content = entry.getData().toString('utf8');
      } catch {
        // Skip binary/unreadable files — store empty content
        content = '';
      }

      const extension = path.extname(relativePath).toLowerCase();

      files.push({ relativePath, content, extension });
    }

    // Determine rootPath: the common top-level directory across all entries
    const rootPath = this._detectRootPath(entries.map((e) => e.entryName));

    // Requirements 1.4, 1.5 — locate and parse package.json at the repo root
    const packageJson = this._findPackageJson(files, rootPath);

    return { rootPath, files, packageJson };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _isZip(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;
    return (
      buffer[0] === ZIP_MAGIC[0] &&
      buffer[1] === ZIP_MAGIC[1] &&
      buffer[2] === ZIP_MAGIC[2] &&
      buffer[3] === ZIP_MAGIC[3]
    );
  }

  /**
   * Returns the single top-level directory shared by all paths, or "/" if the
   * ZIP was created without a wrapping folder (files at archive root).
   */
  private _detectRootPath(entryNames: string[]): string {
    if (entryNames.length === 0) return '/';

    // Collect all unique first path segments
    const firstSegments = new Set<string>();
    for (const name of entryNames) {
      const segment = name.split('/')[0];
      if (segment) firstSegments.add(segment);
    }

    if (firstSegments.size === 1) {
      return Array.from(firstSegments)[0];
    }

    // Multiple top-level entries — no single common root
    return '/';
  }

  /**
   * Searches for package.json at the repository root level.
   * Returns the parsed object or null (Requirement 1.5).
   */
  private _findPackageJson(
    files: FileEntry[],
    rootPath: string,
  ): Record<string, unknown> | null {
    // Candidate paths: at the ZIP root or under the single root directory
    const candidates =
      rootPath === '/'
        ? ['package.json']
        : [`${rootPath}/package.json`];

    for (const candidate of candidates) {
      const entry = files.find(
        (f) => f.relativePath === candidate || f.relativePath === candidate.replace(/\\/g, '/'),
      );
      if (entry) {
        try {
          return JSON.parse(entry.content) as Record<string, unknown>;
        } catch {
          // Malformed package.json — treat as absent
          return null;
        }
      }
    }

    return null;
  }
}
