import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');

/**
 * Full-pipeline integration test.
 *
 * Validates Requirements: 1.1, 7.3, 13.5
 *
 * Creates a fixture ZIP containing a small NestJS + React + Mongoose sample project,
 * uploads it through the analysis pipeline, and verifies:
 *   - A session is created with a valid KB
 *   - KB contains expected technologies, modules, endpoints, components, and entities
 *   - Documentation download routes return correct Content-Type and Content-Disposition headers
 */
describe('Full Pipeline Integration', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  // Build a fixture ZIP programmatically
  function buildFixtureZip(): Buffer {
    const zip = new AdmZip();

    // package.json with NestJS, React, Mongoose
    const packageJson = JSON.stringify({
      name: 'sample-project',
      version: '1.0.0',
      description: 'A sample project for integration testing',
      dependencies: {
        '@nestjs/common': '^10.0.0',
        '@nestjs/core': '^10.0.0',
        react: '^18.2.0',
        mongoose: '^8.0.0',
        axios: '^1.6.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
      },
    });

    zip.addFile('sample-project/package.json', Buffer.from(packageJson));

    // A NestJS controller with @Get and @Post decorators
    const nestController = [
      "import { Controller, Get, Post, Body, Param } from '@nestjs/common';",
      '',
      "@Controller('users')",
      'export class UsersController {',
      '  constructor(private readonly usersService: any) {}',
      '',
      '  @Get()',
      '  findAll() {',
      '    return this.usersService.findAll();',
      '  }',
      '',
      '  @Post()',
      '  create(@Body() dto: any) {',
      '    return this.usersService.create(dto);',
      '  }',
      '',
      "  @Get(':id')",
      '  findOne(@Param(\'id\') id: string) {',
      '    return this.usersService.findOne(id);',
      '  }',
      '}',
    ].join('\n');
    zip.addFile('sample-project/src/users.controller.ts', Buffer.from(nestController));

    // A React TSX component using axios
    const reactComponent = [
      "import React from 'react';",
      "import axios from 'axios';",
      '',
      'export const UserList = () => {',
      '  const [users, setUsers] = React.useState([]);',
      '',
      '  React.useEffect(() => {',
      "    axios.get('/api/users').then(res => setUsers(res.data));",
      '  }, []);',
      '',
      '  return (',
      '    <div>',
      '      <h1>Users</h1>',
      '      {users.map((user: any) => (',
      '        <div key={user.id}>{user.name}</div>',
      '      ))}',
      '    </div>',
      '  );',
      '};',
    ].join('\n');
    zip.addFile('sample-project/src/UserList.tsx', Buffer.from(reactComponent));

    // A Mongoose schema with @Schema() decorator
    const mongooseSchema = [
      "import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';",
      "import { HydratedDocument } from 'mongoose';",
      '',
      'export type UserDocument = HydratedDocument<User>;',
      '',
      '@Schema()',
      'export class User {',
      '  @Prop({ required: true })',
      '  name: string;',
      '',
      '  @Prop({ required: true })',
      '  email: string;',
      '',
      '  @Prop({ default: 0 })',
      '  age: number;',
      '}',
      '',
      'export const UserSchema = SchemaFactory.createForClass(User);',
    ].join('\n');
    zip.addFile('sample-project/src/user.schema.ts', Buffer.from(mongooseSchema));

    // An index.ts file in the src directory (required for module detection)
    const indexTs = [
      "export * from './users.controller';",
      "export * from './user.schema';",
    ].join('\n');
    zip.addFile('sample-project/src/index.ts', Buffer.from(indexTs));

    // An index.ts at the project root (required by ModuleAnalyzer for module boundary detection)
    const rootIndex = [
      "export * from './src/users.controller';",
    ].join('\n');
    zip.addFile('sample-project/index.ts', Buffer.from(rootIndex));

    // A tsconfig.json (for TypeScript technology detection)
    const tsconfig = JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        strict: true,
      },
    });
    zip.addFile('sample-project/tsconfig.json', Buffer.from(tsconfig));

    return zip.toBuffer();
  }

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();

    // Set environment variable before module compilation so MongooseModule.forRootAsync uses it
    process.env.MONGODB_URI = mongoUri;

    // Dynamically import AppModule after setting env
    const { AppModule } = await import('../../app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  let projectId: string;
  let sessionId: string;

  it('should create a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .send({ name: 'Integration Test Project', description: 'Test project' })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    projectId = res.body._id;
  });

  it('should analyze a fixture ZIP and return a sessionId', async () => {
    const zipBuffer = buildFixtureZip();

    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/analyze`)
      .attach('repository', zipBuffer, 'sample-project.zip')
      .expect(202);

    expect(res.body).toHaveProperty('sessionId');
    expect(res.body).toHaveProperty('projectId', projectId);
    sessionId = res.body.sessionId;
  }, 30000);

  it('should return KB with expected technologies, modules, endpoints, components, and entities', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/sessions/${sessionId}`)
      .expect(200);

    const kb = res.body;

    // Technologies: should include NestJS, React, Mongoose, TypeScript
    expect(kb.technologies).toBeDefined();
    expect(kb.technologies.length).toBeGreaterThanOrEqual(1);
    const techNames = kb.technologies.map((t: any) => t.name.toLowerCase());
    expect(techNames).toEqual(
      expect.arrayContaining(['nestjs', 'react', 'mongoose', 'typescript']),
    );

    // Modules: non-empty
    expect(kb.modules).toBeDefined();
    expect(kb.modules.length).toBeGreaterThan(0);

    // Endpoints: non-empty (from the NestJS controller)
    expect(kb.endpoints).toBeDefined();
    expect(kb.endpoints.length).toBeGreaterThan(0);

    // Components: non-empty (from the React TSX component)
    expect(kb.components).toBeDefined();
    expect(kb.components.length).toBeGreaterThan(0);

    // Entities: non-empty (from the Mongoose schema)
    expect(kb.entities).toBeDefined();
    expect(kb.entities.length).toBeGreaterThan(0);
  });

  describe('Documentation download routes', () => {
    it('GET /api/sessions/:id/docs/readme should return text/markdown with readme.md disposition', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sessions/${sessionId}/docs/readme`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.headers['content-disposition']).toContain('readme.md');
    });

    it('GET /api/sessions/:id/docs/architecture should return text/markdown with architecture.md disposition', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sessions/${sessionId}/docs/architecture`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.headers['content-disposition']).toContain('architecture.md');
    });

    it('GET /api/sessions/:id/docs/api should return text/markdown with api.md disposition', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sessions/${sessionId}/docs/api`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.headers['content-disposition']).toContain('api.md');
    });

    it('GET /api/sessions/:id/docs/learning-guide should return text/markdown with learning-guide.md disposition', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sessions/${sessionId}/docs/learning-guide`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.headers['content-disposition']).toContain('learning-guide.md');
    });
  });
});
