// Feature: codebase-understanding-platform, Property 8, 9, 10

import * as fc from 'fast-check';
import { ReactComponentAnalyzer } from '../react-component.analyzer';
import { RepositoryTree, FileEntry, Component, ApiCallRecord } from '../../../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileEntry(
  relativePath: string,
  content: string,
  extension: string = relativePath.endsWith('.tsx') ? '.tsx' : '.jsx',
): FileEntry {
  return { relativePath, content, extension };
}

function makeReactRepo(files: FileEntry[]): RepositoryTree {
  return {
    rootPath: '/',
    files,
    packageJson: {
      dependencies: { react: '18.2.0' },
    },
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** PascalCase component name: starts with uppercase, 3-12 alphanumeric chars */
const arbComponentName = fc
  .tuple(
    fc.stringMatching(/^[A-Z]$/),
    fc.stringMatching(/^[a-z][a-zA-Z0-9]{1,9}$/),
  )
  .map(([first, rest]) => `${first}${rest}`);

/** Simple lowercase path segment for file paths */
const arbPathSegment = fc.stringMatching(/^[a-z][a-z0-9]{1,7}$/);

/** URL-like path for API calls */
const arbApiUrl = fc
  .tuple(
    fc.constantFrom('/api', '/v1', '/v2', 'https://api.example.com'),
    fc.stringMatching(/^\/[a-z][a-z0-9]{1,8}$/),
  )
  .map(([base, path]) => `${base}${path}`);

/** Axios HTTP methods */
const arbAxiosMethod = fc.constantFrom('get', 'post', 'put', 'patch', 'delete');

/** Component type: arrow function, function declaration, or class */
const arbComponentType = fc.constantFrom('arrow', 'function', 'class') as fc.Arbitrary<'arrow' | 'function' | 'class'>;

// ---------------------------------------------------------------------------
// Source code generators
// ---------------------------------------------------------------------------

function buildArrowComponent(name: string): string {
  return [
    `import React from 'react';`,
    ``,
    `export const ${name} = () => {`,
    `  return <div>${name}</div>;`,
    `};`,
  ].join('\n');
}

function buildFunctionComponent(name: string): string {
  return [
    `import React from 'react';`,
    ``,
    `export function ${name}() {`,
    `  return <div>${name}</div>;`,
    `}`,
  ].join('\n');
}

function buildClassComponent(name: string): string {
  return [
    `import React from 'react';`,
    ``,
    `export class ${name} extends React.Component {`,
    `  render() {`,
    `    return <div>${name}</div>;`,
    `  }`,
    `}`,
  ].join('\n');
}

function buildComponentSource(name: string, type: 'arrow' | 'function' | 'class'): string {
  switch (type) {
    case 'arrow':
      return buildArrowComponent(name);
    case 'function':
      return buildFunctionComponent(name);
    case 'class':
      return buildClassComponent(name);
  }
}

function buildComponentWithFetch(name: string, url: string): string {
  return [
    `import React from 'react';`,
    ``,
    `export const ${name} = () => {`,
    `  const data = fetch('${url}');`,
    `  return <div>${name}</div>;`,
    `};`,
  ].join('\n');
}

function buildComponentWithAxios(name: string, method: string, url: string): string {
  return [
    `import React from 'react';`,
    `import axios from 'axios';`,
    ``,
    `export const ${name} = () => {`,
    `  const data = axios.${method}('${url}');`,
    `  return <div>${name}</div>;`,
    `};`,
  ].join('\n');
}

function buildParentComponent(parentName: string, childName: string, childFile: string): string {
  return [
    `import React from 'react';`,
    `import { ${childName} } from '${childFile}';`,
    ``,
    `export const ${parentName} = () => {`,
    `  return <div><${childName} /></div>;`,
    `};`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const analyzer = new ReactComponentAnalyzer();

// ---------------------------------------------------------------------------
// Property 8 — Component detection and record completeness
// Validates: Requirements 5.1, 5.3
// ---------------------------------------------------------------------------

describe('Property 8a — Each exported component is detected (Req 5.1)', () => {
  it('a single exported component always yields >= 1 component record', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbComponentType,
        arbPathSegment,
        async (name, type, filename) => {
          const source = buildComponentSource(name, type);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          expect(components.length).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 8b — Component records have all required fields (Req 5.3)', () => {
  it('every component has id, name, filePath, type, apiCalls, children, parents', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbComponentType,
        arbPathSegment,
        async (name, type, filename) => {
          const source = buildComponentSource(name, type);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          for (const comp of components) {
            // id is a non-empty string
            expect(typeof comp.id).toBe('string');
            expect(comp.id.length).toBeGreaterThan(0);

            // name is a non-empty string
            expect(typeof comp.name).toBe('string');
            expect(comp.name.length).toBeGreaterThan(0);

            // filePath is a non-empty string
            expect(typeof comp.filePath).toBe('string');
            expect(comp.filePath.length).toBeGreaterThan(0);

            // type is 'functional' or 'class'
            expect(['functional', 'class']).toContain(comp.type);

            // apiCalls is an array
            expect(Array.isArray(comp.apiCalls)).toBe(true);

            // children is an array
            expect(Array.isArray(comp.children)).toBe(true);

            // parents is an array
            expect(Array.isArray(comp.parents)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 8c — Detected component name matches the input name (Req 5.1)', () => {
  it('the component name in the record matches the generated name', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbComponentType,
        arbPathSegment,
        async (name, type, filename) => {
          const source = buildComponentSource(name, type);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          const found = components.find((c) => c.name === name);
          expect(found).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 8d — Component type is correctly classified (Req 5.1)', () => {
  it('arrow and function exports yield "functional", class exports yield "class"', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbComponentType,
        arbPathSegment,
        async (name, type, filename) => {
          const source = buildComponentSource(name, type);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          const found = components.find((c) => c.name === name);
          expect(found).toBeDefined();

          const expectedType = type === 'class' ? 'class' : 'functional';
          expect(found!.type).toBe(expectedType);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 8e — Component filePath matches the input file path (Req 5.3)', () => {
  it('filePath on each component matches the relativePath of its source file', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbComponentType,
        arbPathSegment,
        async (name, type, filename) => {
          const source = buildComponentSource(name, type);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          const found = components.find((c) => c.name === name);
          expect(found).toBeDefined();
          expect(found!.filePath).toBe(relativePath);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9 — API call recording
// Validates: Requirements 5.2
// ---------------------------------------------------------------------------

describe('Property 9a — fetch() URLs are recorded in apiCalls (Req 5.2)', () => {
  it('a component with fetch(url) records the URL in its apiCalls', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbApiUrl,
        arbPathSegment,
        async (name, url, filename) => {
          const source = buildComponentWithFetch(name, url);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          const found = components.find((c) => c.name === name);
          expect(found).toBeDefined();
          expect(found!.apiCalls.length).toBeGreaterThanOrEqual(1);

          const urls = found!.apiCalls.map((a) => a.url);
          expect(urls).toContain(url);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 9b — axios.method() URLs are recorded in apiCalls (Req 5.2)', () => {
  it('a component with axios.method(url) records the URL in its apiCalls', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbAxiosMethod,
        arbApiUrl,
        arbPathSegment,
        async (name, method, url, filename) => {
          const source = buildComponentWithAxios(name, method, url);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          const found = components.find((c) => c.name === name);
          expect(found).toBeDefined();
          expect(found!.apiCalls.length).toBeGreaterThanOrEqual(1);

          const urls = found!.apiCalls.map((a) => a.url);
          expect(urls).toContain(url);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 9c — axios method is recorded correctly (Req 5.2)', () => {
  it('the ApiCallRecord method field matches the uppercased axios method', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbAxiosMethod,
        arbApiUrl,
        arbPathSegment,
        async (name, method, url, filename) => {
          const source = buildComponentWithAxios(name, method, url);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          const found = components.find((c) => c.name === name);
          expect(found).toBeDefined();

          const record = found!.apiCalls.find((a) => a.url === url);
          expect(record).toBeDefined();
          expect(record!.method).toBe(method.toUpperCase());
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 9d — fetch() records have null method (Req 5.2)', () => {
  it('ApiCallRecord from fetch() has method === null', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbApiUrl,
        arbPathSegment,
        async (name, url, filename) => {
          const source = buildComponentWithFetch(name, url);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          const found = components.find((c) => c.name === name);
          expect(found).toBeDefined();

          const record = found!.apiCalls.find((a) => a.url === url);
          expect(record).toBeDefined();
          expect(record!.method).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10 — Parent-child relationship recording
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------

describe('Property 10a — Importing a component creates a parent-child relationship (Req 5.4)', () => {
  it('parent component has child ID in children array, child has parent ID in parents array', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbComponentName.filter((n) => n.length > 2),
        arbPathSegment,
        arbPathSegment.filter((s) => s.length > 2),
        async (parentName, childName, parentFile, childFile) => {
          // Ensure distinct names and files
          if (parentName === childName || parentFile === childFile) return;

          const childRelativePath = `src/${childFile}.tsx`;
          const parentRelativePath = `src/${parentFile}.tsx`;

          const childSource = buildArrowComponent(childName);
          const parentSource = buildParentComponent(parentName, childName, `./${childFile}`);

          const repo = makeReactRepo([
            makeFileEntry(childRelativePath, childSource, '.tsx'),
            makeFileEntry(parentRelativePath, parentSource, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          const parent = components.find((c) => c.name === parentName);
          const child = components.find((c) => c.name === childName);

          expect(parent).toBeDefined();
          expect(child).toBeDefined();

          // Parent should have child's ID in its children array
          expect(parent!.children).toContain(child!.id);

          // Child should have parent's ID in its parents array
          expect(child!.parents).toContain(parent!.id);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 10b — Components without imports have empty children (Req 5.4)', () => {
  it('a standalone component has an empty children array', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbComponentType,
        arbPathSegment,
        async (name, type, filename) => {
          const source = buildComponentSource(name, type);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          const found = components.find((c) => c.name === name);
          expect(found).toBeDefined();
          expect(found!.children).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 10c — Components without being imported have empty parents (Req 5.4)', () => {
  it('a component that is not imported by anyone has an empty parents array', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbComponentName,
        arbComponentType,
        arbPathSegment,
        async (name, type, filename) => {
          const source = buildComponentSource(name, type);
          const relativePath = `src/${filename}.tsx`;
          const repo = makeReactRepo([
            makeFileEntry(relativePath, source, '.tsx'),
          ]);

          const result = await analyzer.analyze(repo);
          const components = result.components ?? [];

          const found = components.find((c) => c.name === name);
          expect(found).toBeDefined();
          expect(found!.parents).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Additional edge-case tests
// ---------------------------------------------------------------------------

describe('ReactComponentAnalyzer — detect()', () => {
  it('returns true when .tsx files exist', () => {
    const repo = makeReactRepo([
      makeFileEntry('src/App.tsx', '', '.tsx'),
    ]);
    expect(analyzer.detect(repo)).toBe(true);
  });

  it('returns true when .jsx files exist', () => {
    const repo: RepositoryTree = {
      rootPath: '/',
      files: [makeFileEntry('src/App.jsx', '', '.jsx')],
      packageJson: null,
    };
    expect(analyzer.detect(repo)).toBe(true);
  });

  it('returns false when no JSX/TSX files exist', () => {
    const repo: RepositoryTree = {
      rootPath: '/',
      files: [makeFileEntry('src/index.ts', '', '.ts')],
      packageJson: null,
    };
    expect(analyzer.detect(repo)).toBe(false);
  });
});

describe('ReactComponentAnalyzer — files with no recognizable component', () => {
  it('skips files without exported components (Req 5.5)', async () => {
    const source = `const helper = () => 'not a component';`;
    const repo = makeReactRepo([
      makeFileEntry('src/utils.tsx', source, '.tsx'),
    ]);

    const result = await analyzer.analyze(repo);
    expect(result.components).toBeDefined();
    expect(result.components).toHaveLength(0);
  });
});
