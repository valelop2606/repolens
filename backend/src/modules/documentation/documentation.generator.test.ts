import { DocumentationGenerator } from './documentation.generator';
import { KnowledgeBase } from '../../shared/types';

describe('DocumentationGenerator', () => {
  let generator: DocumentationGenerator;

  const createMinimalKB = (overrides: Partial<KnowledgeBase> = {}): KnowledgeBase => {
    const base: KnowledgeBase = {
      sessionId: 'test-session',
      projectId: 'test-project',
      createdAt: new Date(),
      metadata: {
        name: 'TestProject',
        version: '1.0.0',
        description: 'A test project',
        dependencies: { express: '^4.18.0' },
        hasPackageJson: true,
      },
      technologies: [
        { name: 'TypeScript', confidence: 'high', detectedBy: 'package.json' },
        { name: 'React', confidence: 'high', detectedBy: 'package.json' },
      ],
      modules: [
        {
          id: 'mod-1',
          name: 'auth',
          rootPath: 'src/modules/auth',
          files: ['auth.service.ts', 'auth.controller.ts'],
          description: 'Module handling auth functionality',
          dependencies: ['mod-2'],
        },
        {
          id: 'mod-2',
          name: 'users',
          rootPath: 'src/modules/users',
          files: ['users.service.ts'],
          description: 'Module handling users functionality',
          dependencies: [],
        },
      ],
      endpoints: [
        {
          id: 'ep-1',
          method: 'POST',
          path: '/api/auth/login',
          sourceFile: 'src/modules/auth/auth.controller.ts',
          lineNumber: 15,
          middlewares: ['AuthGuard'],
          serviceFunction: 'login',
          serviceFile: 'auth.service.ts',
        },
        {
          id: 'ep-2',
          method: 'GET',
          path: '/api/users',
          sourceFile: 'src/modules/users/users.controller.ts',
          lineNumber: 10,
          middlewares: [],
          serviceFunction: 'findAll',
          serviceFile: 'users.service.ts',
        },
      ],
      components: [
        {
          id: 'comp-1',
          name: 'LoginForm',
          filePath: 'src/components/LoginForm.tsx',
          type: 'functional',
          apiCalls: [{ url: '/api/auth/login', method: 'POST' }],
          children: [],
          parents: [],
        },
      ],
      entities: [
        {
          id: 'ent-1',
          name: 'User',
          ormType: 'mongoose',
          fields: [
            { name: 'email', type: 'String', required: true },
            { name: 'password', type: 'String', required: true },
          ],
          relationships: [],
          sourceFile: 'src/schemas/user.schema.ts',
        },
      ],
      dependencyGraph: {
        nodes: ['mod-1', 'mod-2'],
        edges: [{ from: 'mod-1', to: 'mod-2', isCircular: false }],
      },
      featureFlows: [],
      warnings: [],
      isComplete: true,
    };
    return { ...base, ...overrides };
  };

  beforeEach(() => {
    generator = new DocumentationGenerator();
  });

  describe('generateReadme', () => {
    it('should contain the project name', () => {
      const kb = createMinimalKB();
      const result = generator.generateReadme(kb);
      expect(result).toContain('TestProject');
    });

    it('should contain the technology stack', () => {
      const kb = createMinimalKB();
      const result = generator.generateReadme(kb);
      expect(result).toContain('TypeScript');
      expect(result).toContain('React');
      expect(result).toContain('Technology Stack');
    });

    it('should contain module list', () => {
      const kb = createMinimalKB();
      const result = generator.generateReadme(kb);
      expect(result).toContain('auth');
      expect(result).toContain('users');
    });

    it('should return non-empty string', () => {
      const kb = createMinimalKB();
      const result = generator.generateReadme(kb);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty technologies and modules', () => {
      const kb = createMinimalKB({ technologies: [], modules: [] });
      const result = generator.generateReadme(kb);
      expect(result).toContain('No technologies detected');
      expect(result).toContain('No modules detected');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('generateArchitectureSummary', () => {
    it('should contain module names', () => {
      const kb = createMinimalKB();
      const result = generator.generateArchitectureSummary(kb);
      expect(result).toContain('auth');
      expect(result).toContain('users');
    });

    it('should contain dependency edges', () => {
      const kb = createMinimalKB();
      const result = generator.generateArchitectureSummary(kb);
      expect(result).toContain('mod-1');
      expect(result).toContain('mod-2');
    });

    it('should return non-empty string', () => {
      const kb = createMinimalKB();
      const result = generator.generateArchitectureSummary(kb);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty modules and edges', () => {
      const kb = createMinimalKB({
        modules: [],
        dependencyGraph: { nodes: [], edges: [] },
      });
      const result = generator.generateArchitectureSummary(kb);
      expect(result).toContain('No modules detected');
      expect(result).toContain('No dependency edges detected');
    });
  });

  describe('generateApiDocs', () => {
    it('should list all endpoints', () => {
      const kb = createMinimalKB();
      const result = generator.generateApiDocs(kb);
      expect(result).toContain('POST');
      expect(result).toContain('/api/auth/login');
      expect(result).toContain('GET');
      expect(result).toContain('/api/users');
    });

    it('should show middleware', () => {
      const kb = createMinimalKB();
      const result = generator.generateApiDocs(kb);
      expect(result).toContain('AuthGuard');
    });

    it('should show service function', () => {
      const kb = createMinimalKB();
      const result = generator.generateApiDocs(kb);
      expect(result).toContain('login');
      expect(result).toContain('findAll');
    });

    it('should emit "No endpoints detected" when list is empty', () => {
      const kb = createMinimalKB({ endpoints: [] });
      const result = generator.generateApiDocs(kb);
      expect(result).toContain('No endpoints detected');
    });

    it('should return non-empty string', () => {
      const kb = createMinimalKB();
      const result = generator.generateApiDocs(kb);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('generateLearningGuide', () => {
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

    it('should contain all eight Learning Journey stage names', () => {
      const kb = createMinimalKB();
      const result = generator.generateLearningGuide(kb);
      for (const stage of stages) {
        expect(result).toContain(stage);
      }
    });

    it('should return non-empty string', () => {
      const kb = createMinimalKB();
      const result = generator.generateLearningGuide(kb);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty KB gracefully', () => {
      const kb = createMinimalKB({
        technologies: [],
        modules: [],
        endpoints: [],
        components: [],
        entities: [],
        dependencyGraph: { nodes: [], edges: [] },
      });
      const result = generator.generateLearningGuide(kb);
      for (const stage of stages) {
        expect(result).toContain(stage);
      }
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
