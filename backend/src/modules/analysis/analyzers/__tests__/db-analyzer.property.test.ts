// Feature: codebase-understanding-platform, Property 11, 12

import * as fc from 'fast-check';
import { DatabaseEntityAnalyzer } from '../database-entity.analyzer';
import { RepositoryTree, FileEntry, Entity, EntityRelationship } from '../../../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileEntry(
  relativePath: string,
  content: string,
  extension: string = '.ts',
): FileEntry {
  return { relativePath, content, extension };
}

function makeMongooseRepo(files: FileEntry[]): RepositoryTree {
  return {
    rootPath: '/',
    files,
    packageJson: {
      dependencies: { mongoose: '8.2.1' },
    },
  };
}

function makeSequelizeRepo(files: FileEntry[]): RepositoryTree {
  return {
    rootPath: '/',
    files,
    packageJson: {
      dependencies: { sequelize: '6.37.0' },
    },
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** camelCase field name: starts with lowercase letter, 2-10 alphanumeric chars */
const arbFieldName = fc
  .tuple(
    fc.stringMatching(/^[a-z]$/),
    fc.stringMatching(/^[a-zA-Z0-9]{1,8}$/),
  )
  .map(([first, rest]) => `${first}${rest}`);

/** PascalCase entity/model name */
const arbEntityName = fc
  .tuple(
    fc.stringMatching(/^[A-Z]$/),
    fc.stringMatching(/^[a-z][a-zA-Z0-9]{1,8}$/),
  )
  .map(([first, rest]) => `${first}${rest}`);

/** Mongoose field type (plain schema style) */
const arbMongooseType = fc.constantFrom('String', 'Number', 'Boolean', 'Date', 'Buffer');

/** Sequelize DataTypes */
const arbSequelizeType = fc.constantFrom(
  'DataTypes.STRING',
  'DataTypes.INTEGER',
  'DataTypes.BOOLEAN',
  'DataTypes.DATE',
  'DataTypes.FLOAT',
);

/** Random boolean for required flag */
const arbRequired = fc.boolean();

/** Simple lowercase path segment */
const arbPathSegment = fc.stringMatching(/^[a-z][a-z0-9]{1,7}$/);

/** Sequelize relationship type */
const arbSequelizeRelType = fc.constantFrom('belongsTo', 'hasMany', 'hasOne') as fc.Arbitrary<'belongsTo' | 'hasMany' | 'hasOne'>;

// ---------------------------------------------------------------------------
// Source code generators
// ---------------------------------------------------------------------------

interface FieldDef {
  name: string;
  type: string;
  required: boolean;
}

function buildMongooseDecoratorSchema(entityName: string, fields: FieldDef[]): string {
  const propLines = fields.map((f) => {
    const propArg = f.required ? `{ required: true }` : `{}`;
    return `  @Prop(${propArg})\n  ${f.name}: ${f.type.toLowerCase()};`;
  });

  return [
    `import { Schema, Prop } from '@nestjs/mongoose';`,
    ``,
    `@Schema()`,
    `export class ${entityName} {`,
    ...propLines,
    `}`,
  ].join('\n');
}

function buildMongoosePlainSchema(entityName: string, fields: FieldDef[]): string {
  const fieldLines = fields.map((f) => {
    if (f.required) {
      return `  ${f.name}: { type: ${f.type}, required: true },`;
    }
    return `  ${f.name}: { type: ${f.type} },`;
  });

  return [
    `import mongoose, { Schema } from 'mongoose';`,
    ``,
    `const ${entityName}Schema = new Schema({`,
    ...fieldLines,
    `});`,
  ].join('\n');
}

function buildMongooseSchemaWithRef(
  entityName: string,
  fields: FieldDef[],
  refFieldName: string,
  refTarget: string,
): string {
  const fieldLines = fields.map((f) => {
    return `  ${f.name}: { type: ${f.type}, required: ${f.required} },`;
  });

  return [
    `import mongoose, { Schema } from 'mongoose';`,
    ``,
    `const ${entityName}Schema = new Schema({`,
    ...fieldLines,
    `  ${refFieldName}: { type: Schema.Types.ObjectId, ref: '${refTarget}' },`,
    `});`,
  ].join('\n');
}

function buildMongooseDecoratorWithRef(
  entityName: string,
  fields: FieldDef[],
  refFieldName: string,
  refTarget: string,
): string {
  const propLines = fields.map((f) => {
    const propArg = f.required ? `{ required: true }` : `{}`;
    return `  @Prop(${propArg})\n  ${f.name}: ${f.type.toLowerCase()};`;
  });

  return [
    `import { Schema, Prop } from '@nestjs/mongoose';`,
    `import mongoose from 'mongoose';`,
    ``,
    `@Schema()`,
    `export class ${entityName} {`,
    ...propLines,
    `  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: '${refTarget}' })`,
    `  ${refFieldName}: string;`,
    `}`,
  ].join('\n');
}

function buildSequelizeModel(entityName: string, fields: FieldDef[]): string {
  const fieldLines = fields.map((f) => {
    if (f.required) {
      return `  ${f.name}: { type: ${f.type}, allowNull: false },`;
    }
    return `  ${f.name}: ${f.type},`;
  });

  return [
    `import { Model, DataTypes } from 'sequelize';`,
    ``,
    `class ${entityName} extends Model {}`,
    `${entityName}.init({`,
    ...fieldLines,
    `}, { sequelize });`,
  ].join('\n');
}

function buildSequelizeModelWithRelationships(
  entityName: string,
  fields: FieldDef[],
  relationships: Array<{ type: 'belongsTo' | 'hasMany' | 'hasOne'; target: string }>,
): string {
  const fieldLines = fields.map((f) => {
    if (f.required) {
      return `  ${f.name}: { type: ${f.type}, allowNull: false },`;
    }
    return `  ${f.name}: ${f.type},`;
  });

  const relLines = relationships.map((r) => `${entityName}.${r.type}(${r.target});`);

  return [
    `import { Model, DataTypes } from 'sequelize';`,
    ``,
    `class ${entityName} extends Model {}`,
    `${entityName}.init({`,
    ...fieldLines,
    `}, { sequelize });`,
    ``,
    ...relLines,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const analyzer = new DatabaseEntityAnalyzer();

// ---------------------------------------------------------------------------
// Property 11 — ORM entity extraction and record completeness
// Validates: Requirements 6.1, 6.3
// ---------------------------------------------------------------------------

describe('Property 11a — Mongoose @Schema decorator entity extraction (Req 6.1, 6.3)', () => {
  it('a @Schema class with random fields produces an entity with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbEntityName,
        fc.array(
          fc.tuple(arbFieldName, arbMongooseType, arbRequired),
          { minLength: 1, maxLength: 5 },
        ),
        arbPathSegment,
        async (entityName, fieldTuples, filename) => {
          // Ensure unique field names
          const seenNames = new Set<string>();
          const fields: FieldDef[] = [];
          for (const [name, type, required] of fieldTuples) {
            if (!seenNames.has(name)) {
              seenNames.add(name);
              fields.push({ name, type, required });
            }
          }
          if (fields.length === 0) return;

          const source = buildMongooseDecoratorSchema(entityName, fields);
          const relativePath = `src/${filename}.ts`;
          const repo = makeMongooseRepo([
            makeFileEntry(relativePath, source),
          ]);

          const result = await analyzer.analyze(repo);
          const entities = result.entities ?? [];

          // Should find at least one entity
          expect(entities.length).toBeGreaterThanOrEqual(1);

          const found = entities.find((e) => e.name === entityName);
          expect(found).toBeDefined();

          // Verify record completeness (Req 6.3)
          expect(typeof found!.id).toBe('string');
          expect(found!.id.length).toBeGreaterThan(0);
          expect(found!.name).toBe(entityName);
          expect(found!.ormType).toBe('mongoose');
          expect(Array.isArray(found!.fields)).toBe(true);
          expect(Array.isArray(found!.relationships)).toBe(true);
          expect(found!.sourceFile).toBe(relativePath);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 11b — Mongoose new Schema() entity extraction (Req 6.1, 6.3)', () => {
  it('a new Schema({...}) definition with random fields produces an entity with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbEntityName,
        fc.array(
          fc.tuple(arbFieldName, arbMongooseType, arbRequired),
          { minLength: 1, maxLength: 5 },
        ),
        arbPathSegment,
        async (entityName, fieldTuples, filename) => {
          // Ensure unique field names
          const seenNames = new Set<string>();
          const fields: FieldDef[] = [];
          for (const [name, type, required] of fieldTuples) {
            if (!seenNames.has(name)) {
              seenNames.add(name);
              fields.push({ name, type, required });
            }
          }
          if (fields.length === 0) return;

          const source = buildMongoosePlainSchema(entityName, fields);
          const relativePath = `src/${filename}.ts`;
          const repo = makeMongooseRepo([
            makeFileEntry(relativePath, source),
          ]);

          const result = await analyzer.analyze(repo);
          const entities = result.entities ?? [];

          expect(entities.length).toBeGreaterThanOrEqual(1);

          const found = entities.find((e) => e.name === entityName);
          expect(found).toBeDefined();

          // Verify record completeness (Req 6.3)
          expect(typeof found!.id).toBe('string');
          expect(found!.id.length).toBeGreaterThan(0);
          expect(found!.ormType).toBe('mongoose');
          expect(Array.isArray(found!.fields)).toBe(true);
          expect(Array.isArray(found!.relationships)).toBe(true);
          expect(found!.sourceFile).toBe(relativePath);

          // Verify fields are extracted
          for (const field of fields) {
            const fieldRecord = found!.fields.find((f) => f.name === field.name);
            expect(fieldRecord).toBeDefined();
            expect(fieldRecord!.type).toBe(field.type);
            expect(fieldRecord!.required).toBe(field.required);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 11c — Sequelize model entity extraction (Req 6.2, 6.3)', () => {
  it('a Sequelize Model.init({...}) with random fields produces an entity with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbEntityName,
        fc.array(
          fc.tuple(arbFieldName, arbSequelizeType, arbRequired),
          { minLength: 1, maxLength: 5 },
        ),
        arbPathSegment,
        async (entityName, fieldTuples, filename) => {
          // Ensure unique field names
          const seenNames = new Set<string>();
          const fields: FieldDef[] = [];
          for (const [name, type, required] of fieldTuples) {
            if (!seenNames.has(name)) {
              seenNames.add(name);
              fields.push({ name, type, required });
            }
          }
          if (fields.length === 0) return;

          const source = buildSequelizeModel(entityName, fields);
          const relativePath = `src/${filename}.ts`;
          const repo = makeSequelizeRepo([
            makeFileEntry(relativePath, source),
          ]);

          const result = await analyzer.analyze(repo);
          const entities = result.entities ?? [];

          expect(entities.length).toBeGreaterThanOrEqual(1);

          const found = entities.find((e) => e.name === entityName);
          expect(found).toBeDefined();

          // Verify record completeness (Req 6.3)
          expect(typeof found!.id).toBe('string');
          expect(found!.id.length).toBeGreaterThan(0);
          expect(found!.ormType).toBe('sequelize');
          expect(Array.isArray(found!.fields)).toBe(true);
          expect(Array.isArray(found!.relationships)).toBe(true);
          expect(found!.sourceFile).toBe(relativePath);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 11d — Empty entities when no models found (Req 6.5)', () => {
  it('files without any model definitions produce empty entities array', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPathSegment,
        async (filename) => {
          const source = `const x = 42;\nfunction hello() { return 'world'; }`;
          const relativePath = `src/${filename}.ts`;
          const repo = makeMongooseRepo([
            makeFileEntry(relativePath, source),
          ]);

          const result = await analyzer.analyze(repo);
          const entities = result.entities ?? [];

          expect(entities).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12 — Entity relationship recording
// Validates: Requirements 6.4
// ---------------------------------------------------------------------------

describe('Property 12a — Mongoose ref relationships are recorded (Req 6.4)', () => {
  it('a schema with ref field produces a relationship record with correct target', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbEntityName,
        fc.array(
          fc.tuple(arbFieldName, arbMongooseType, arbRequired),
          { minLength: 1, maxLength: 3 },
        ),
        arbFieldName,
        arbEntityName,
        arbPathSegment,
        async (entityName, fieldTuples, refFieldName, refTarget, filename) => {
          // Ensure ref field name is distinct from other fields and entity names are distinct
          const seenNames = new Set<string>();
          const fields: FieldDef[] = [];
          for (const [name, type, required] of fieldTuples) {
            if (!seenNames.has(name) && name !== refFieldName) {
              seenNames.add(name);
              fields.push({ name, type, required });
            }
          }

          // Ensure entity names are different
          if (entityName === refTarget) return;

          const source = buildMongooseSchemaWithRef(entityName, fields, refFieldName, refTarget);
          const relativePath = `src/${filename}.ts`;
          const repo = makeMongooseRepo([
            makeFileEntry(relativePath, source),
          ]);

          const result = await analyzer.analyze(repo);
          const entities = result.entities ?? [];

          const found = entities.find((e) => e.name === entityName);
          expect(found).toBeDefined();

          // Should have at least one relationship
          expect(found!.relationships.length).toBeGreaterThanOrEqual(1);

          // Find the ref relationship
          const refRel = found!.relationships.find(
            (r) => r.type === 'ref' && r.targetEntity === refTarget,
          );
          expect(refRel).toBeDefined();
          expect(refRel!.field).toBe(refFieldName);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 12b — Mongoose @Prop ref relationships via decorator (Req 6.4)', () => {
  it('a @Schema class with ref prop produces a relationship record', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbEntityName,
        fc.array(
          fc.tuple(arbFieldName, arbMongooseType, arbRequired),
          { minLength: 1, maxLength: 3 },
        ),
        arbFieldName,
        arbEntityName,
        arbPathSegment,
        async (entityName, fieldTuples, refFieldName, refTarget, filename) => {
          const seenNames = new Set<string>();
          const fields: FieldDef[] = [];
          for (const [name, type, required] of fieldTuples) {
            if (!seenNames.has(name) && name !== refFieldName) {
              seenNames.add(name);
              fields.push({ name, type, required });
            }
          }

          if (entityName === refTarget) return;

          const source = buildMongooseDecoratorWithRef(entityName, fields, refFieldName, refTarget);
          const relativePath = `src/${filename}.ts`;
          const repo = makeMongooseRepo([
            makeFileEntry(relativePath, source),
          ]);

          const result = await analyzer.analyze(repo);
          const entities = result.entities ?? [];

          const found = entities.find((e) => e.name === entityName);
          expect(found).toBeDefined();

          // Should have at least one ref relationship
          const refRel = found!.relationships.find(
            (r) => r.type === 'ref' && r.targetEntity === refTarget,
          );
          expect(refRel).toBeDefined();
          expect(refRel!.field).toBe(refFieldName);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 12c — Sequelize relationships are recorded (Req 6.4)', () => {
  it('belongsTo/hasMany/hasOne declarations produce relationship records', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbEntityName,
        fc.array(
          fc.tuple(arbFieldName, arbSequelizeType, arbRequired),
          { minLength: 1, maxLength: 3 },
        ),
        fc.array(
          fc.tuple(arbSequelizeRelType, arbEntityName),
          { minLength: 1, maxLength: 3 },
        ),
        arbPathSegment,
        async (entityName, fieldTuples, relTuples, filename) => {
          const seenNames = new Set<string>();
          const fields: FieldDef[] = [];
          for (const [name, type, required] of fieldTuples) {
            if (!seenNames.has(name)) {
              seenNames.add(name);
              fields.push({ name, type, required });
            }
          }
          if (fields.length === 0) return;

          // Ensure relationship targets are different from entity name and unique
          const seenTargets = new Set<string>();
          const relationships: Array<{ type: 'belongsTo' | 'hasMany' | 'hasOne'; target: string }> = [];
          for (const [relType, target] of relTuples) {
            const key = `${relType}-${target}`;
            if (target !== entityName && !seenTargets.has(key)) {
              seenTargets.add(key);
              relationships.push({ type: relType, target });
            }
          }
          if (relationships.length === 0) return;

          const source = buildSequelizeModelWithRelationships(entityName, fields, relationships);
          const relativePath = `src/${filename}.ts`;
          const repo = makeSequelizeRepo([
            makeFileEntry(relativePath, source),
          ]);

          const result = await analyzer.analyze(repo);
          const entities = result.entities ?? [];

          const found = entities.find((e) => e.name === entityName);
          expect(found).toBeDefined();

          // Each relationship should appear in the output
          for (const rel of relationships) {
            const foundRel = found!.relationships.find(
              (r) => r.type === rel.type && r.targetEntity === rel.target,
            );
            expect(foundRel).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Additional edge-case tests
// ---------------------------------------------------------------------------

describe('DatabaseEntityAnalyzer — detect()', () => {
  it('returns true when mongoose is in dependencies', () => {
    const repo = makeMongooseRepo([]);
    expect(analyzer.detect(repo)).toBe(true);
  });

  it('returns true when sequelize is in dependencies', () => {
    const repo = makeSequelizeRepo([]);
    expect(analyzer.detect(repo)).toBe(true);
  });

  it('returns false when no ORM is in dependencies', () => {
    const repo: RepositoryTree = {
      rootPath: '/',
      files: [],
      packageJson: {
        dependencies: { express: '4.18.0' },
      },
    };
    expect(analyzer.detect(repo)).toBe(false);
  });

  it('returns false when packageJson is null', () => {
    const repo: RepositoryTree = {
      rootPath: '/',
      files: [],
      packageJson: null,
    };
    expect(analyzer.detect(repo)).toBe(false);
  });
});
