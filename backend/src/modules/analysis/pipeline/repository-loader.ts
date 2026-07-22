import AdmZip from 'adm-zip';
import path from 'path';
import { FileEntry, RepositoryTree } from '../../../shared/types';

// ZIP magic bytes: PK\x03\x04
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// 200 MB in bytes
const MAX_FILE_SIZE = 200 * 1024 * 1024;

export class RepositoryLoaderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RepositoryLoaderError';
  }
}

/**
 * Stage 1 of the analysis pipeline.
 *
 * Responsibilities:
 *  - Accept a ZIP buffer
 *  - Validate size and format
 *  - Extract all file entries
 *  - Detect the repository root path
 *  - Locate and parse package.json
 */
export class RepositoryLoader {
  load(zipBuffer: Buffer): RepositoryTree {
    if (zipBuffer.length > MAX_FILE_SIZE) {
      throw new RepositoryLoaderError(
        'FILE_TOO_LARGE',
        `Uploaded file exceeds the 200 MB size limit (received ${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB).`,
      );
    }

    if (!this._isZip(zipBuffer)) {
      throw new RepositoryLoaderError(
        'INVALID_FORMAT',
        'Uploaded file is not a valid ZIP archive. Please upload a .zip file.',
      );
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      throw new RepositoryLoaderError(
        'EXTRACTION_FAILED',
        'Failed to open the ZIP archive. The file may be corrupt.',
      );
    }

    const entries = zip.getEntries();
    const files: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const relativePath = entry.entryName;
      let content: string;
      try {
        content = entry.getData().toString('utf8');
      } catch {
        content = '';
      }

      files.push({
        relativePath,
        content,
        extension: path.extname(relativePath).toLowerCase(),
      });
    }

    const rootPath = this._detectRootPath(entries.map((e) => e.entryName));
    const packageJson = this._findPackageJson(files, rootPath);

    return { rootPath, files, packageJson };
  }

  private _isZip(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;
    return (
      buffer[0] === ZIP_MAGIC[0] &&
      buffer[1] === ZIP_MAGIC[1] &&
      buffer[2] === ZIP_MAGIC[2] &&
      buffer[3] === ZIP_MAGIC[3]
    );
  }

  private _detectRootPath(entryNames: string[]): string {
    if (entryNames.length === 0) return '/';
    const firstSegments = new Set<string>();
    for (const name of entryNames) {
      const segment = name.split('/')[0];
      if (segment) firstSegments.add(segment);
    }
    return firstSegments.size === 1 ? Array.from(firstSegments)[0] : '/';
  }

  private _findPackageJson(
    files: FileEntry[],
    rootPath: string,
  ): Record<string, unknown> | null {
    const candidates =
      rootPath === '/' ? ['package.json'] : [`${rootPath}/package.json`];

    for (const candidate of candidates) {
      const entry = files.find(
        (f) => f.relativePath === candidate || f.relativePath === candidate.replace(/\\/g, '/'),
      );
      if (entry) {
        try {
          return JSON.parse(entry.content) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}
