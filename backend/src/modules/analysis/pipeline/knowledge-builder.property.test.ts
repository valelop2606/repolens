// Feature: codebase-understanding-platform, Property 13, 14, 15
import * as fc from 'fast-check';
import { KnowledgeBuilder } from './knowledge-builder';
import { PartialAnalysisResult, RepositoryTree } from '../../../shared/types';

describe('KnowledgeBuilder — Property Tests', () => {
  const builder = new KnowledgeBuilder();

  // --- Arbitraries ---

  const arbTechnology = fc.record({
    name: fc.string({ minLength: 1 }),
    confidence: fc.constantFrom('high' as const, 'medium' as const, 'low' as const),
    detectedBy: fc.string({ minLength: 1 }),
  });

  const arbModule = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1 }),
    rootPath: fc.string({ minLength: 1 }),
    files: fc.array(fc.string({ minLength: 1 })),
    description: fc.string(),
    dependencies: fc.array(fc.uuid()),
  });

  const arbEndpoint = fc.record({
    id: fc.uuid(),
    method: fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
    path: fc.string({ minLength: 1 }),
    sourceFile: fc.string({ minLength: 1 }),
    lineNumber: fc.nat({ max: 10000 }),
    middlewares: fc.array(fc.string()),
    serviceFunction: fc.option(fc.string({ minLength: 1 }), { nil: null }),
    serviceFile: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  });

  const arbComponent = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1 }),
    filePath: fc.string({ minLength: 1 }),
    type: fc.constantFrom('functional' as const, 'class' as const),
    apiCalls: fc.array(
      fc.record({
        url: fc.string({ minLength: 1 }),
        method: fc.option(fc.string({ minLength: 1 }), { nil: null }),
      }),
    ),
    children: fc.array(fc.uuid()),
    parents: fc.array(fc.uuid()),
  });

  const arbEntity = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1 }),
    ormType: fc.constantFrom('mongoose' as const, 'sequelize' as const, 'unknown' as const),
    fields: fc.array(
      fc.record({
        name: fc.string({ minLength: 1 }),
        type: fc.string({ minLength: 1 }),
        required: fc.boolean(),
      }),
    ),
    relationships: fc.array(
      fc.record({
        type: fc.constantFrom('ref' as const, 'belongsTo' as const, 'hasMany' as const, 'hasOne' as const),
        targetEntity: fc.string({ minLength: 1 }),
        field: fc.string({ minLength: 1 }),
      }),
    ),
    sourceFile: fc.string({ minLength: 1 }),
  });

  const arbDependencyEdge = fc.record({
    from: fc.uuid(),
    to: fc.uuid(),
    isCircular: fc.boolean(),
  });

  const arbWarning = fc.record({
    code: fc.string({ minLength: 1 }),
    message: fc.string({ minLength: 1 }),
    file: fc.option(fc.string({ minLength: 1 }), { nil: null }),
    severity: fc.constantFrom('info' as const, 'warning' as const, 'error' as const),
  });

  const arbPartialResult: fc.Arbitrary<PartialAnalysisResult> = fc.record(
    {
      technologies: fc.array(arbTechnology, { maxLength: 5 }),
      modules: fc.array(arbModule, { maxLength: 3 }),
      endpoints: fc.array(arbEndpoint, { maxLength: 3 }),
      components: fc.array(arbComponent, { maxLength: 3 }),
      entities: fc.array(arbEntity, { maxLength: 3 }),
      dependencyEdges: fc.array(arbDependencyEdge, { maxLength: 5 }),
      warnings: fc.array(arbWarning, { maxLength: 3 }),
    },
    { requiredKeys: [] },
  );

  const arbFileEntry = fc.record({
    relativePath: fc.string({ minLength: 1 }),
    content: fc.string(),
    extension: fc.constantFrom('.ts', '.js', '.json', '.tsx', '.jsx'),
  });

  const arbRepoTree: fc.Arbitrary<RepositoryTree> = fc.record({
    rootPath: fc.string({ minLength: 1 }),
    files: fc.array(arbFileEntry, { maxLength: 5 }),
    packageJson: fc.option(
      fc.record({
        name: fc.string({ minLength: 1 }),
        version: fc.string({ minLength: 1 }),
        description: fc.string(),
        dependencies: fc.dictionary(fc.string({ minLength: 1 }), fc.string({ minLength: 1 })),
      }),
      { nil: null },
    ),
  });

  // --- Property 13: KB assembly completeness ---
  // **Validates: Requirements 7.1, 7.2, 7.3**
  describe('Property 13: KB assembly completeness', () => {
    it('assembled KB has all top-level keys with correct types', () => {
      fc.assert(
        fc.property(
          fc.array(arbPartialResult, { minLength: 0, maxLength: 5 }),
          arbRepoTree,
          fc.uuid(),
          (partials, repo, projectId) => {
            const kb = builder.assemble(partials, repo, projectId);

            // sessionId is a string (UUID)
            expect(typeof kb.sessionId).toBe('string');
            expect(kb.sessionId.length).toBeGreaterThan(0);

            // projectId is the one we passed in
            expect(kb.projectId).toBe(projectId);

            // createdAt is a Date
            expect(kb.createdAt).toBeInstanceOf(Date);

            // metadata has required keys
            expect(typeof kb.metadata).toBe('object');
            expect(typeof kb.metadata.name).toBe('string');
            expect(typeof kb.metadata.version).toBe('string');
            expect(typeof kb.metadata.description).toBe('string');
            expect(typeof kb.metadata.dependencies).toBe('object');
            expect(typeof kb.metadata.hasPackageJson).toBe('boolean');

            // arrays
            expect(Array.isArray(kb.technologies)).toBe(true);
            expect(Array.isArray(kb.modules)).toBe(true);
            expect(Array.isArray(kb.endpoints)).toBe(true);
            expect(Array.isArray(kb.components)).toBe(true);
            expect(Array.isArray(kb.entities)).toBe(true);
            expect(Array.isArray(kb.featureFlows)).toBe(true);
            expect(Array.isArray(kb.warnings)).toBe(true);

            // dependencyGraph has nodes and edges
            expect(typeof kb.dependencyGraph).toBe('object');
            expect(Array.isArray(kb.dependencyGraph.nodes)).toBe(true);
            expect(Array.isArray(kb.dependencyGraph.edges)).toBe(true);

            // isComplete is boolean
            expect(typeof kb.isComplete).toBe('boolean');
            expect(kb.isComplete).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // --- Property 14: Metadata extraction ---
  // **Validates: Requirements 7.1, 7.4**
  describe('Property 14: Metadata extraction', () => {
    it('correctly derives metadata from package.json', () => {
      const arbPackageJson = fc.record({
        name: fc.string({ minLength: 1 }),
        version: fc.string({ minLength: 1 }),
        description: fc.string(),
      });

      fc.assert(
        fc.property(arbPackageJson, fc.uuid(), (pkg, projectId) => {
          const repo: RepositoryTree = {
            rootPath: '/test-repo',
            files: [],
            packageJson: pkg,
          };

          const kb = builder.assemble([], repo, projectId);

          expect(kb.metadata.name).toBe(pkg.name);
          expect(kb.metadata.version).toBe(pkg.version);
          expect(kb.metadata.description).toBe(pkg.description);
          expect(kb.metadata.hasPackageJson).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('returns defaults and hasPackageJson=false when packageJson is null', () => {
      fc.assert(
        fc.property(fc.uuid(), (projectId) => {
          const repo: RepositoryTree = {
            rootPath: '/test-repo',
            files: [],
            packageJson: null,
          };

          const kb = builder.assemble([], repo, projectId);

          expect(kb.metadata.name).toBe('Unknown Project');
          expect(kb.metadata.version).toBe('0.0.0');
          expect(kb.metadata.description).toBe('');
          expect(kb.metadata.hasPackageJson).toBe(false);
        }),
        { numRuns: 50 },
      );
    });
  });

  // --- Property 15: Session isolation ---
  // **Validates: Requirements 7.2**
  describe('Property 15: Session isolation', () => {
    it('two assemble calls produce different sessionId UUIDs', () => {
      fc.assert(
        fc.property(
          fc.array(arbPartialResult, { maxLength: 3 }),
          arbRepoTree,
          fc.uuid(),
          (partials, repo, projectId) => {
            const kb1 = builder.assemble(partials, repo, projectId);
            const kb2 = builder.assemble(partials, repo, projectId);

            expect(kb1.sessionId).not.toBe(kb2.sessionId);
            // Both should be valid UUID v4 format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(kb1.sessionId).toMatch(uuidRegex);
            expect(kb2.sessionId).toMatch(uuidRegex);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
