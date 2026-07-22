// ============================================================
// Shared TypeScript interfaces — Single Source of Truth
// All modules import types from here; never duplicate.
// ============================================================

// --- Repository ---

export interface RepositoryTree {
  rootPath: string;
  files: FileEntry[];
  packageJson: Record<string, unknown> | null;
}

export interface FileEntry {
  relativePath: string;
  content: string;
  extension: string;
}

// --- Analysis ---

export interface PartialAnalysisResult {
  technologies?: Technology[];
  modules?: Module[];
  endpoints?: Endpoint[];
  components?: Component[];
  entities?: Entity[];
  dependencyEdges?: DependencyEdge[];
  warnings?: AnalysisWarning[];
}

// --- Knowledge Base ---

export interface KnowledgeBase {
  sessionId: string;
  projectId: string;
  createdAt: Date;
  metadata: ProjectMetadata;
  technologies: Technology[];
  modules: Module[];
  endpoints: Endpoint[];
  components: Component[];
  entities: Entity[];
  dependencyGraph: DependencyGraph;
  featureFlows: FeatureFlow[];
  warnings: AnalysisWarning[];
  isComplete: boolean;
}

export interface ProjectMetadata {
  name: string;
  version: string;
  description: string;
  dependencies: Record<string, string>;
  hasPackageJson: boolean;
}

// --- Technology ---

export interface Technology {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  detectedBy: string;
}

// --- Module ---

export interface Module {
  id: string;
  name: string;
  rootPath: string;
  files: string[];
  description: string;
  dependencies: string[]; // module IDs this module depends on
}

// --- Endpoint ---

export interface Endpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | string;
  path: string;
  sourceFile: string;
  lineNumber: number;
  middlewares: string[];
  serviceFunction: string | null;
  serviceFile: string | null;
}

// --- Component ---

export interface Component {
  id: string;
  name: string;
  filePath: string;
  type: 'functional' | 'class';
  apiCalls: ApiCallRecord[];
  children: string[]; // component IDs
  parents: string[];  // component IDs
}

export interface ApiCallRecord {
  url: string;
  method: string | null; // null if not determinable statically
}

// --- Entity ---

export interface Entity {
  id: string;
  name: string;
  ormType: 'mongoose' | 'sequelize' | 'unknown';
  fields: EntityField[];
  relationships: EntityRelationship[];
  sourceFile: string;
}

export interface EntityField {
  name: string;
  type: string;
  required: boolean;
}

export interface EntityRelationship {
  type: 'ref' | 'belongsTo' | 'hasMany' | 'hasOne';
  targetEntity: string;
  field: string;
}

// --- Dependency Graph ---

export interface DependencyGraph {
  nodes: string[]; // module IDs
  edges: DependencyEdge[];
}

export interface DependencyEdge {
  from: string;    // module ID
  to: string;      // module ID
  isCircular: boolean;
}

// --- Feature Flow ---

export interface FeatureFlow {
  id: string;
  name: string;
  steps: FlowStep[];
}

export interface FlowStep {
  layer:
    | 'ui-screen'
    | 'component'
    | 'api-request'
    | 'route'
    | 'controller'
    | 'service'
    | 'database'
    | 'response';
  entityId: string | null;
  entityType: 'component' | 'endpoint' | 'entity' | null;
  label: string;
  resolved: boolean;
}

// --- Warnings ---

export interface AnalysisWarning {
  code: string;
  message: string;
  file: string | null;
  severity: 'info' | 'warning' | 'error';
}

// --- AI Conversation ---

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AssistantResponse {
  content: string;
  citations: EntityCitation[];
}

export interface EntityCitation {
  entityId: string;
  entityType: 'module' | 'endpoint' | 'component' | 'entity';
  label: string;
}

// --- Project status ---

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';
