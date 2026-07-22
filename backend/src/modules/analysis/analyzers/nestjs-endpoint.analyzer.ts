import { v4 as uuidv4 } from 'uuid';
import {
  RepositoryTree,
  PartialAnalysisResult,
  Endpoint,
} from '../../../shared/types';
import { Analyzer } from '../interfaces/analyzer.interface';

/**
 * Stage 4 of the analysis pipeline — Endpoint Extraction.
 *
 * Primary: NestJS controller decorators (@Get, @Post, @Put, @Patch, @Delete)
 * Fallback: Express app.METHOD / router.METHOD patterns
 *
 * Satisfies Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export class NestjsEndpointAnalyzer implements Analyzer {
  readonly name = 'NestjsEndpointAnalyzer';

  /**
   * Active when @nestjs/common is in production dependencies,
   * OR as fallback when express is in production dependencies.
   */
  detect(repo: RepositoryTree): boolean {
    const deps = this._getDeps(repo);
    return deps.has('@nestjs/common') || deps.has('express');
  }

  async analyze(repo: RepositoryTree): Promise<PartialAnalysisResult> {
    const deps = this._getDeps(repo);
    const isNestJs = deps.has('@nestjs/common');

    const sourceFiles = repo.files.filter(
      (f) => f.extension === '.ts' || f.extension === '.js',
    );

    // Build a filename → relativePath map for resolving service files from imports
    const filePathMap = new Map<string, string>();
    for (const file of repo.files) {
      const base = file.relativePath.replace(/\\/g, '/').split('/').pop() ?? '';
      filePathMap.set(base, file.relativePath);
    }

    const endpoints: Endpoint[] = [];

    if (isNestJs) {
      for (const file of sourceFiles) {
        const extracted = this._extractNestJsEndpoints(file.content, file.relativePath, repo);
        endpoints.push(...extracted);
      }
    }

    // Express fallback: if no NestJS routes found and express is present
    if (endpoints.length === 0 && deps.has('express')) {
      for (const file of sourceFiles) {
        const extracted = this._extractExpressEndpoints(file.content, file.relativePath);
        endpoints.push(...extracted);
      }
    }

    return { endpoints };
  }

  // ---------------------------------------------------------------------------
  // NestJS extraction
  // ---------------------------------------------------------------------------

  private _extractNestJsEndpoints(
    content: string,
    relativePath: string,
    repo: RepositoryTree,
  ): Endpoint[] {
    const endpoints: Endpoint[] = [];
    const lines = content.split('\n');

    // Extract controller base path: @Controller('basePath') or @Controller()
    const controllerBasePath = this._extractControllerBase(content);

    // Build import map: identifier → file path
    const importMap = this._buildImportMap(content, relativePath, repo);

    // Find each HTTP method decorator
    const methodDecoratorPattern = /@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:'([^']*)'|"([^"]*)"|\`([^`]*)\`)?\s*\)/g;

    let match: RegExpExecArray | null;
    while ((match = methodDecoratorPattern.exec(content)) !== null) {
      const decoratorMethod = match[1].toUpperCase() as Endpoint['method'];
      const routePath = match[2] ?? match[3] ?? match[4] ?? '';

      const lineNumber = this._lineNumberOf(content, match.index);

      // Combine base path + method path
      const fullPath = this._combinePaths(controllerBasePath, routePath);

      // Extract guard/interceptor decorators just before this handler
      const middlewares = this._extractMiddlewares(content, match.index);

      // Extract service call from the handler body
      const { serviceFunction, serviceFile } = this._extractServiceCall(
        content,
        match.index,
        importMap,
      );

      endpoints.push({
        id: uuidv4(),
        method: decoratorMethod,
        path: fullPath,
        sourceFile: relativePath,
        lineNumber,
        middlewares,
        serviceFunction,
        serviceFile,
      });
    }

    return endpoints;
  }

  // ---------------------------------------------------------------------------
  // Express extraction
  // ---------------------------------------------------------------------------

  private _extractExpressEndpoints(content: string, relativePath: string): Endpoint[] {
    const endpoints: Endpoint[] = [];

    // Matches: app.get('/path', ...) or router.post('/path', ...)
    const expressPattern = /(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*(?:'([^']*)'|"([^"]*)"|\`([^`]*)\`)/gi;

    let match: RegExpExecArray | null;
    while ((match = expressPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase() as Endpoint['method'];
      const rawPath = match[2] ?? match[3] ?? match[4] ?? '/';

      const lineNumber = this._lineNumberOf(content, match.index);
      const normalizedPath = this._normalizePath(rawPath);

      endpoints.push({
        id: uuidv4(),
        method,
        path: normalizedPath,
        sourceFile: relativePath,
        lineNumber,
        middlewares: [],
        serviceFunction: null,
        serviceFile: null,
      });
    }

    return endpoints;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Extract controller base path from @Controller('path') decorator */
  private _extractControllerBase(content: string): string {
    const controllerMatch = /@Controller\s*\(\s*(?:'([^']*)'|"([^"]*)"|\`([^`]*)\`)?\s*\)/.exec(content);
    if (!controllerMatch) return '';
    return controllerMatch[1] ?? controllerMatch[2] ?? controllerMatch[3] ?? '';
  }

  /** Combine controller base path and method path, normalizing slashes */
  private _combinePaths(base: string, method: string): string {
    const normalBase = this._normalizePath(base);
    if (!method) return normalBase || '/';

    const normalMethod = this._normalizePath(method);
    if (normalBase === '/') return normalMethod;

    // Remove trailing slash from base before joining
    return normalBase.replace(/\/$/, '') + normalMethod;
  }

  /** Ensure path starts with / */
  private _normalizePath(path: string): string {
    if (!path) return '/';
    return path.startsWith('/') ? path : `/${path}`;
  }

  /** Get 1-based line number for a given character index in the content */
  private _lineNumberOf(content: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index; i++) {
      if (content[i] === '\n') line++;
    }
    return line;
  }

  /**
   * Scan backwards from a decorator position to collect @UseGuards / @UseInterceptors names.
   * Look at the last ~500 characters before the method decorator.
   */
  private _extractMiddlewares(content: string, decoratorIndex: number): string[] {
    const lookback = content.slice(Math.max(0, decoratorIndex - 500), decoratorIndex);
    const middlewares: string[] = [];
    const guardPattern = /@(UseGuards|UseInterceptors)\s*\(\s*([^)]+)\)/g;

    let m: RegExpExecArray | null;
    while ((m = guardPattern.exec(lookback)) !== null) {
      // m[2] may contain multiple comma-separated names like "AuthGuard, RolesGuard"
      const names = m[2].split(',').map((s) => s.trim()).filter(Boolean);
      middlewares.push(...names);
    }

    return middlewares;
  }

  /**
   * Find the handler function body after the decorator and look for
   * `this.someService.someMethod(` patterns.
   */
  private _extractServiceCall(
    content: string,
    decoratorIndex: number,
    importMap: Map<string, string>,
  ): { serviceFunction: string | null; serviceFile: string | null } {
    // Move to handler body: find the opening brace of the method after the decorator
    const slice = content.slice(decoratorIndex);

    // Find the first { after the decorator line
    const braceOpen = slice.indexOf('{');
    if (braceOpen === -1) return { serviceFunction: null, serviceFile: null };

    // Find the matching closing brace (simple brace counter)
    let depth = 0;
    let braceClose = -1;
    for (let i = braceOpen; i < slice.length; i++) {
      if (slice[i] === '{') depth++;
      else if (slice[i] === '}') {
        depth--;
        if (depth === 0) {
          braceClose = i;
          break;
        }
      }
    }

    const handlerBody = braceClose !== -1
      ? slice.slice(braceOpen, braceClose + 1)
      : slice.slice(braceOpen, Math.min(braceOpen + 300, slice.length));

    // Look for this.someService.someMethod(
    const serviceCallPattern = /this\.(\w+)\.(\w+)\s*\(/;
    const callMatch = serviceCallPattern.exec(handlerBody);
    if (!callMatch) return { serviceFunction: null, serviceFile: null };

    const serviceIdentifier = callMatch[1];  // e.g. "usersService"
    const serviceFunction = callMatch[2];     // e.g. "findAll"

    // Try to resolve the service file from the import map
    const serviceFile = importMap.get(serviceIdentifier) ?? null;

    return { serviceFunction, serviceFile };
  }

  /**
   * Build a map from imported identifier → resolved relative path.
   * e.g. import { UsersService } from './users.service' → "usersService" → "src/modules/users/users.service.ts"
   */
  private _buildImportMap(
    content: string,
    currentPath: string,
    repo: RepositoryTree,
  ): Map<string, string> {
    const importMap = new Map<string, string>();
    const importPattern = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;

    const currentDir = currentPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');

    let m: RegExpExecArray | null;
    while ((m = importPattern.exec(content)) !== null) {
      const identifiers = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      const importSpecifier = m[2];

      // Resolve the import to a relative path
      const resolvedPath = this._resolveImportPath(currentDir, importSpecifier, repo);
      if (!resolvedPath) continue;

      for (const id of identifiers) {
        // Map the class name to a camelCase property name (UsersService → usersService)
        const propName = id.charAt(0).toLowerCase() + id.slice(1);
        importMap.set(propName, resolvedPath);
        // Also store by the original identifier in case someone names the field differently
        importMap.set(id, resolvedPath);
      }
    }

    return importMap;
  }

  /** Resolve a relative import specifier to an actual file path in the repo */
  private _resolveImportPath(
    currentDir: string,
    importSpecifier: string,
    repo: RepositoryTree,
  ): string | null {
    const parts = currentDir ? currentDir.split('/') : [];
    const specParts = importSpecifier.split('/');

    const stack = [...parts];
    for (const seg of specParts) {
      if (seg === '..') {
        if (stack.length > 0) stack.pop();
      } else if (seg !== '.') {
        stack.push(seg);
      }
    }

    const base = stack.join('/');

    // Try common extensions
    for (const ext of ['.ts', '.js']) {
      const candidate = `${base}${ext}`;
      const found = repo.files.find((f) => f.relativePath.replace(/\\/g, '/') === candidate);
      if (found) return found.relativePath;
    }

    return null;
  }

  /** Get production dependencies from packageJson */
  private _getDeps(repo: RepositoryTree): Set<string> {
    const pkg = repo.packageJson ?? {};
    const deps = (pkg['dependencies'] as Record<string, string>) ?? {};
    return new Set(Object.keys(deps));
  }
}
