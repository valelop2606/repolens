import { v4 as uuidv4 } from 'uuid';
import {
  RepositoryTree,
  PartialAnalysisResult,
  Entity,
  EntityField,
  EntityRelationship,
} from '../../../shared/types';
import { Analyzer } from '../interfaces/analyzer.interface';

/**
 * Stage 6 of the analysis pipeline — Database Entity Extraction.
 *
 * Detects Mongoose schemas (@Schema decorator and new Schema({...}))
 * and Sequelize model definitions in source files.
 *
 * Satisfies Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export class DatabaseEntityAnalyzer implements Analyzer {
  readonly name = 'DatabaseEntityAnalyzer';

  /**
   * Active when `mongoose` or `sequelize` appear in packageJson.dependencies.
   */
  detect(repo: RepositoryTree): boolean {
    if (!repo.packageJson) return false;
    const deps = (repo.packageJson as Record<string, unknown>).dependencies;
    if (!deps || typeof deps !== 'object') return false;
    const depKeys = Object.keys(deps as Record<string, unknown>);
    return depKeys.includes('mongoose') || depKeys.includes('sequelize');
  }

  async analyze(repo: RepositoryTree): Promise<PartialAnalysisResult> {
    const entities: Entity[] = [];

    for (const file of repo.files) {
      // Only analyze TypeScript/JavaScript source files
      if (!['.ts', '.js', '.mts', '.mjs'].includes(file.extension)) continue;

      const mongooseEntities = this._extractMongooseEntities(file.content, file.relativePath);
      entities.push(...mongooseEntities);

      const sequelizeEntities = this._extractSequelizeEntities(file.content, file.relativePath);
      entities.push(...sequelizeEntities);
    }

    return { entities };
  }

  // ---------------------------------------------------------------------------
  // Mongoose extraction
  // ---------------------------------------------------------------------------

  /**
   * Extract Mongoose entities from:
   * 1. @Schema() decorator with class definition (NestJS/Mongoose style)
   * 2. new Schema({...}) (plain Mongoose style)
   */
  private _extractMongooseEntities(content: string, relativePath: string): Entity[] {
    const entities: Entity[] = [];

    // Pattern 1: @Schema() decorator class
    const schemaDecoratorPattern = /@Schema\(\)\s*(?:export\s+)?class\s+([A-Za-z][A-Za-z0-9]*)/g;
    let match: RegExpExecArray | null;

    while ((match = schemaDecoratorPattern.exec(content)) !== null) {
      const name = match[1];
      const classBody = this._extractClassBody(content, match.index);
      const fields = this._extractDecoratorFields(classBody);
      const relationships = this._extractMongooseRefRelationships(classBody, fields);

      entities.push({
        id: uuidv4(),
        name,
        ormType: 'mongoose',
        fields,
        relationships,
        sourceFile: relativePath,
      });
    }

    // Pattern 2: new Schema({...})
    // Match: const XxxSchema = new Schema({ ... })
    // Or: const xxxSchema = new mongoose.Schema({ ... })
    const newSchemaPattern = /(?:const|let|var)\s+([A-Za-z][A-Za-z0-9]*)(?:Schema)?\s*=\s*new\s+(?:mongoose\.)?Schema\s*\(/g;
    while ((match = newSchemaPattern.exec(content)) !== null) {
      let name = match[1];
      // Remove trailing "Schema" suffix if the variable is like "UserSchema"
      if (name.endsWith('Schema')) {
        name = name.slice(0, -6);
      }
      // Capitalize first letter
      name = name.charAt(0).toUpperCase() + name.slice(1);

      const schemaBody = this._extractSchemaObject(content, match.index + match[0].length);
      const fields = this._extractPlainSchemaFields(schemaBody);
      const relationships = this._extractPlainSchemaRelationships(schemaBody, fields);

      // Avoid duplicates — if a @Schema decorator already produced this entity name, skip
      if (!entities.some((e) => e.name === name && e.sourceFile === relativePath)) {
        entities.push({
          id: uuidv4(),
          name,
          ormType: 'mongoose',
          fields,
          relationships,
          sourceFile: relativePath,
        });
      }
    }

    return entities;
  }

  /**
   * Extract the class body after a @Schema() decorator match.
   */
  private _extractClassBody(content: string, startIndex: number): string {
    let braceCount = 0;
    let started = false;
    let bodyStart = startIndex;
    let bodyEnd = content.length;

    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        if (!started) {
          started = true;
          bodyStart = i;
        }
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          bodyEnd = i + 1;
          break;
        }
      }
    }

    return content.slice(bodyStart, bodyEnd);
  }

  /**
   * Extract fields from a @Prop() decorated class body.
   * Pattern: @Prop(...) fieldName: Type;
   */
  private _extractDecoratorFields(classBody: string): EntityField[] {
    const fields: EntityField[] = [];
    // Match @Prop({...}) or @Prop() followed by field name: type
    const propPattern = /@Prop\(([^)]*)\)\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\??\s*:\s*([^;=\n]+))?/g;
    let match: RegExpExecArray | null;

    while ((match = propPattern.exec(classBody)) !== null) {
      const propArgs = match[1] || '';
      const fieldName = match[2];
      const fieldType = (match[3] || 'unknown').trim();

      const required = /required\s*:\s*true/.test(propArgs);

      fields.push({
        name: fieldName,
        type: fieldType,
        required,
      });
    }

    return fields;
  }

  /**
   * Extract Mongoose ref relationships from @Prop decorator arguments.
   * Pattern: @Prop({ type: ..., ref: 'EntityName' })
   */
  private _extractMongooseRefRelationships(
    classBody: string,
    fields: EntityField[],
  ): EntityRelationship[] {
    const relationships: EntityRelationship[] = [];
    const refPattern = /@Prop\(([^)]*)\)\s*([A-Za-z_][A-Za-z0-9_]*)/g;
    let match: RegExpExecArray | null;

    while ((match = refPattern.exec(classBody)) !== null) {
      const propArgs = match[1];
      const fieldName = match[2];

      // Look for ref: 'EntityName' or ref: "EntityName"
      const refMatch = propArgs.match(/ref\s*:\s*['"]([^'"]+)['"]/);
      if (refMatch) {
        relationships.push({
          type: 'ref',
          targetEntity: refMatch[1],
          field: fieldName,
        });
      }
    }

    return relationships;
  }

  /**
   * Extract the schema object content from new Schema({ ... })
   */
  private _extractSchemaObject(content: string, startIndex: number): string {
    // Find the opening brace after the opening parenthesis
    let braceCount = 0;
    let started = false;
    let bodyStart = startIndex;
    let bodyEnd = content.length;

    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        if (!started) {
          started = true;
          bodyStart = i;
        }
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          bodyEnd = i + 1;
          break;
        }
      }
    }

    return content.slice(bodyStart, bodyEnd);
  }

  /**
   * Extract fields from plain Mongoose schema definition.
   * Patterns:
   *   fieldName: { type: String, required: true }
   *   fieldName: String
   */
  private _extractPlainSchemaFields(schemaBody: string): EntityField[] {
    const fields: EntityField[] = [];
    // Match field definitions: fieldName: { ... } or fieldName: Type
    const fieldPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:\{([^}]*)\}|([A-Za-z][A-Za-z0-9.]*))/g;
    let match: RegExpExecArray | null;

    while ((match = fieldPattern.exec(schemaBody)) !== null) {
      const fieldName = match[1];
      const objectContent = match[2];
      const directType = match[3];

      // Skip common schema config keys
      if (['timestamps', 'collection', 'versionKey', 'toJSON', 'toObject'].includes(fieldName)) {
        continue;
      }

      let type = 'unknown';
      let required = false;

      if (objectContent) {
        // Parse type from object: { type: String, required: true }
        const typeMatch = objectContent.match(/type\s*:\s*([A-Za-z][A-Za-z0-9.]*)/);
        if (typeMatch) {
          type = typeMatch[1];
        }
        required = /required\s*:\s*true/.test(objectContent);
      } else if (directType) {
        type = directType;
      }

      fields.push({ name: fieldName, type, required });
    }

    return fields;
  }

  /**
   * Extract ref relationships from plain Mongoose schema.
   * Pattern: ref: 'EntityName'
   */
  private _extractPlainSchemaRelationships(
    schemaBody: string,
    fields: EntityField[],
  ): EntityRelationship[] {
    const relationships: EntityRelationship[] = [];
    // Match field with ref: fieldName: { type: ..., ref: 'Entity' }
    const fieldRefPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{([^}]*ref\s*:\s*['"]([^'"]+)['"][^}]*)\}/g;
    let match: RegExpExecArray | null;

    while ((match = fieldRefPattern.exec(schemaBody)) !== null) {
      const fieldName = match[1];
      const targetEntity = match[3];

      relationships.push({
        type: 'ref',
        targetEntity,
        field: fieldName,
      });
    }

    return relationships;
  }

  // ---------------------------------------------------------------------------
  // Sequelize extraction
  // ---------------------------------------------------------------------------

  /**
   * Extract Sequelize entities from:
   * 1. Model class definition with init({...})
   * 2. Relationship declarations (belongsTo, hasMany, hasOne)
   */
  private _extractSequelizeEntities(content: string, relativePath: string): Entity[] {
    const entities: Entity[] = [];

    // Pattern: class Name extends Model
    const modelClassPattern = /class\s+([A-Za-z][A-Za-z0-9]*)\s+extends\s+Model/g;
    let match: RegExpExecArray | null;

    while ((match = modelClassPattern.exec(content)) !== null) {
      const name = match[1];

      // Look for Model.init({...}) to extract fields
      const initPattern = new RegExp(`${name}\\.init\\s*\\(`);
      const initMatch = initPattern.exec(content);
      let fields: EntityField[] = [];

      if (initMatch) {
        const initBody = this._extractSchemaObject(content, initMatch.index + initMatch[0].length);
        fields = this._extractSequelizeFields(initBody);
      }

      // Extract relationships for this model
      const relationships = this._extractSequelizeRelationships(content, name);

      entities.push({
        id: uuidv4(),
        name,
        ormType: 'sequelize',
        fields,
        relationships,
        sourceFile: relativePath,
      });
    }

    return entities;
  }

  /**
   * Extract fields from Sequelize Model.init({ ... }) object.
   * Patterns:
   *   fieldName: { type: DataTypes.STRING, allowNull: false }
   *   fieldName: DataTypes.STRING
   */
  private _extractSequelizeFields(initBody: string): EntityField[] {
    const fields: EntityField[] = [];
    const fieldPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:\{([^}]*)\}|([A-Za-z][A-Za-z0-9.]*))/g;
    let match: RegExpExecArray | null;

    while ((match = fieldPattern.exec(initBody)) !== null) {
      const fieldName = match[1];
      const objectContent = match[2];
      const directType = match[3];

      // Skip Sequelize config keys
      if (['sequelize', 'modelName', 'tableName', 'timestamps', 'paranoid', 'underscored'].includes(fieldName)) {
        continue;
      }

      let type = 'unknown';
      let required = false;

      if (objectContent) {
        const typeMatch = objectContent.match(/type\s*:\s*([A-Za-z][A-Za-z0-9.]*)/);
        if (typeMatch) {
          type = typeMatch[1];
        }
        // In Sequelize, allowNull: false means required
        required = /allowNull\s*:\s*false/.test(objectContent);
      } else if (directType) {
        type = directType;
      }

      fields.push({ name: fieldName, type, required });
    }

    return fields;
  }

  /**
   * Extract Sequelize relationship declarations.
   * Patterns:
   *   ModelName.belongsTo(TargetModel)
   *   ModelName.hasMany(TargetModel)
   *   ModelName.hasOne(TargetModel)
   */
  private _extractSequelizeRelationships(
    content: string,
    modelName: string,
  ): EntityRelationship[] {
    const relationships: EntityRelationship[] = [];

    const relPattern = new RegExp(
      `${modelName}\\.(belongsTo|hasMany|hasOne)\\s*\\(\\s*([A-Za-z][A-Za-z0-9]*)`,
      'g',
    );
    let match: RegExpExecArray | null;

    while ((match = relPattern.exec(content)) !== null) {
      const relType = match[1] as 'belongsTo' | 'hasMany' | 'hasOne';
      const targetEntity = match[2];

      relationships.push({
        type: relType,
        targetEntity,
        field: relType, // Use the relationship type as the field identifier
      });
    }

    return relationships;
  }
}
