// Feature: codebase-understanding-platform, Property 18
import * as fc from 'fast-check';
import { DocumentationGenerator } from '../documentation.generator';
import { KnowledgeBase } from '../../../shared/types';

/**
 * Property 18: Documentation generation completeness
 *
 * For any KnowledgeBase:
 * - generateReadme returns a non-empty Markdown string containing the project name and technology stack
 * - generateArchitectureSummary returns a non-empty Markdown string containing module names
 * - generateApiDocs returns a non-empty Markdown string listing all endpoints (or "No endpoints detected" notice)
 * - generateLearningGuide returns a non-empty Markdown string containing all eight Learning Journey stage names
 *
 * **Validates: Requirements 13.1–13.5**
 */
describe('DocumentationGenerator — Property Tests', () => {
  const generator = new DocumentationGenerator();

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

  const arbFeatureFlow = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1 }),
    steps: fc.array(
      fc.record({
        layer: fc.constantFrom(
          'ui-screen' as const,
          'component' as const,
          'api-request' as const,
          'route' as const,
          'controller' as const,
          'service' as const,
          'database' as const,
          'response' as const,
        ),
        entityId: fc.option(fc.uuid(), { nil: null }),
        entityType: fc.option(
          fc.constantFrom('component' as const, 'endpoint' as const, 'entity' as const),
          { nil: null },
        ),
        label: fc.string({ minLength: 1 }),
        resolved: fc.boolean(),
      }),
    ),
  });

  const arbProjectMetadata = fc.record({
    name: fc.string({ minLength: 1 }),
    version: fc.string({ minLength: 1 }),
    description: fc.string(),
    dependencies: fc.dictionary(fc.string({ minLength: 1 }), fc.string({ minLength: 1 })),
    hasPackageJson: fc.boolean(),
  });

  const arbKnowledgeBase: fc.Arbitrary<KnowledgeBase> = fc.record({
    sessionId: fc.uuid(),
    projectId: fc.uuid(),
    createdAt: fc.date(),
    metadata: arbProjectMetadata,
    technologies: fc.array(arbTechnology, { maxLength: 5 }),
    modules: fc.array(arbModule, { maxLength: 4 }),
    endpoints: fc.array(arbEndpoint, { maxLength: 4 }),
    components: fc.array(arbComponent, { maxLength: 4 }),
    entities: fc.array(arbEntity, { maxLength: 4 }),
    dependencyGraph: fc.record({
      nodes: fc.array(fc.uuid(), { maxLength: 5 }),
      edges: fc.array(arbDependencyEdge, { maxLength: 5 }),
    }),
    featureFlows: fc.array(arbFeatureFlow, { maxLength: 3 }),
    warnings: fc.array(arbWarning, { maxLength: 3 }),
    isComplete: fc.boolean(),
  });

  // --- Property 18: Documentation generation completeness ---

  describe('Property 18: Documentation generation completeness', () => {
    it('generateReadme returns a non-empty string containing the project name and "Technology Stack"', () => {
      fc.assert(
        fc.property(arbKnowledgeBase, (kb) => {
          const result = generator.generateReadme(kb);

          // Non-empty
          expect(result.length).toBeGreaterThan(0);

          // Contains project name
          expect(result).toContain(kb.metadata.name);

          // Contains technology stack section header
          expect(result).toContain('Technology Stack');
        }),
        { numRuns: 100 },
      );
    });

    it('generateArchitectureSummary returns a non-empty string containing module names', () => {
      fc.assert(
        fc.property(arbKnowledgeBase, (kb) => {
          const result = generator.generateArchitectureSummary(kb);

          // Non-empty
          expect(result.length).toBeGreaterThan(0);

          // Contains each module name
          for (const mod of kb.modules) {
            expect(result).toContain(mod.name);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('generateApiDocs returns a non-empty string listing all endpoints or "No endpoints detected"', () => {
      fc.assert(
        fc.property(arbKnowledgeBase, (kb) => {
          const result = generator.generateApiDocs(kb);

          // Non-empty
          expect(result.length).toBeGreaterThan(0);

          if (kb.endpoints.length === 0) {
            // Should contain notice when no endpoints
            expect(result).toContain('No endpoints detected');
          } else {
            // Should contain each endpoint path
            for (const ep of kb.endpoints) {
              expect(result).toContain(ep.path);
            }
          }
        }),
        { numRuns: 100 },
      );
    });

    it('generateLearningGuide returns a non-empty string containing all 8 Learning Journey stage names', () => {
      const stages = [
        'Project Overview',
        'Architecture',
        'Business Modules',
        'Authentication',
        'Core Features',
        'API',
        'Database',
        'Ready for your first task',
      ];

      fc.assert(
        fc.property(arbKnowledgeBase, (kb) => {
          const result = generator.generateLearningGuide(kb);

          // Non-empty
          expect(result.length).toBeGreaterThan(0);

          // Contains all 8 stage names
          for (const stage of stages) {
            expect(result).toContain(stage);
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
