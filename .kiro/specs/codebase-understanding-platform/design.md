# Design Document: Codebase Understanding Platform

## Overview

The Codebase Understanding Platform is a full-stack web application that accepts a ZIP-packaged JavaScript/TypeScript repository, runs a pipeline of pluggable analyzers over it, assembles the results into a Knowledge Base, and serves that Knowledge Base through five interactive views: Understand, Learning Journey, Explorer, Feature Flow Tracer, and AI Assistant. A Documentation Generator allows exporting findings as Markdown files.

The design prioritizes hackathon speed: a single Node.js/Express API server, a React + TypeScript SPA, and in-memory session storage. Every subsystem is a self-contained module that can be extended or swapped without touching adjacent modules.

---

## Architecture

```mermaid
graph TD
    subgraph Browser
        UI[React SPA]
    end

    subgraph API Server (Express)
        UploadRoute[POST /api/upload]
        SessionRoute[GET /api/session/:id]
        ViewRoutes[GET /api/session/:id/...]
        AIRoute[POST /api/session/:id/ask]
        DocsRoute[GET /api/session/:id/docs/:type]
    end

    subgraph Analysis Pipeline
        RE[Repository Engine]
        AE[Analysis Engine]
        KB_Builder[Knowledge Builder]
    end

    subgraph Analyzers
        TDA[Tech Detection Analyzer]
        MA[Module Analyzer]
        EA[Express Endpoint Analyzer]
        CA[React Component Analyzer]
        DBA[Database Entity Analyzer]
    end

    subgraph Storage
        Sessions[(In-Memory Session Store)]
    end

    subgraph External
        LLM[LLM API - OpenAI]
    end

    UI -->|multipart/form-data| UploadRoute
    UploadRoute --> RE
    RE --> AE
    AE --> TDA & MA & EA & CA & DBA
    TDA & MA & EA & CA & DBA --> KB_Builder
    KB_Builder --> Sessions
    Sessions --> SessionRoute & ViewRoutes & AIRoute & DocsRoute
    AIRoute --> LLM
    ViewRoutes --> UI
    DocsRoute --> UI
```

### Key Architectural Decisions

**Single backend process**: For hackathon simplicity the Express server runs the entire analysis pipeline synchronously within the upload request. For large repos the pipeline runs with a 30-second timeout and streams progress via Server-Sent Events if needed.

**In-memory session store**: Knowledge Bases are stored in a `Map<sessionId, KnowledgeBase>` in process memory. Sessions expire after 2 hours. This removes the need for a database while remaining sufficient for demo use.

**Pluggable Analyzer interface**: All analyzers implement a common `Analyzer` interface. The `Analysis_Engine` discovers and invokes them without hardcoded references, satisfying Requirement 14.

**LLM integration**: The AI Assistant sends the serialized Knowledge Base as context in the system prompt and relays user messages with a sliding 10-message history window.

---

## Components and Interfaces

### Backend

#### `Analyzer` Interface (Requirement 14.3)

```typescript
interface Analyzer {
  name: string;
  detect(repo: RepositoryTree): boolean;
  analyze(repo: RepositoryTree): Promise<PartialAnalysisResult>;
}
```

#### `RepositoryTree`

```typescript
interface RepositoryTree {
  rootPath: string;
  files: FileEntry[];
  packageJson: Record<string, unknown> | null;
}

interface FileEntry {
  relativePath: string;
  content: string;
  extension: string;
}
```

#### `PartialAnalysisResult`

```typescript
interface PartialAnalysisResult {
  technologies?: Technology[];
  modules?: Module[];
  endpoints?: Endpoint[];
  components?: Component[];
  entities?: Entity[];
  dependencyEdges?: DependencyEdge[];
  warnings?: AnalysisWarning[];
}
```

#### `KnowledgeBase`

```typescript
interface KnowledgeBase {
  sessionId: string;
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
```

#### `RepositoryEngine`

```
upload(zipBuffer: Buffer): Promise<RepositoryTree>
```

- Validates file size (≤ 200 MB) and MIME type / magic bytes
- Extracts ZIP using `adm-zip` or `jszip`
- Reads `package.json` if present
- Returns `RepositoryTree`

#### `AnalysisEngine`

```
run(repo: RepositoryTree): Promise<PartialAnalysisResult[]>
```

- Iterates over registered analyzers
- Calls `detect()` — skips if `false`
- Calls `analyze()` in a try/catch — records warning on exception
- Returns array of partial results

#### `KnowledgeBuilder`

```
assemble(partials: PartialAnalysisResult[], repo: RepositoryTree): KnowledgeBase
persist(kb: KnowledgeBase): string   // returns sessionId
get(sessionId: string): KnowledgeBase | null
```

#### `DocumentationGenerator`

```
generateReadme(kb: KnowledgeBase): string
generateArchitectureSummary(kb: KnowledgeBase): string
generateApiDocs(kb: KnowledgeBase): string
generateLearningGuide(kb: KnowledgeBase): string
```

#### `AIAssistantService`

```
ask(sessionId: string, history: Message[], question: string): Promise<AssistantResponse>
```

- Builds system prompt from KB serialization
- Sends last min(history.length, 10) messages + new question to LLM
- Parses response, extracts entity references, builds navigable links

### Frontend (React + TypeScript)

#### Component Tree

```
App
├── UploadPage
│   └── ZipDropzone
├── SessionLayout (wraps all views once session exists)
│   ├── Sidebar (navigation)
│   ├── UnderstandView
│   │   ├── ProjectHeader
│   │   ├── TechStackBadges
│   │   ├── ModuleList
│   │   ├── DependencyGraphCanvas (D3 or react-force-graph)
│   │   └── WarningPanel
│   ├── LearningJourneyView
│   │   ├── StageList
│   │   └── StageDetail
│   ├── ExplorerView
│   │   ├── ExplorerSidebar (category nav)
│   │   └── EntityDetail
│   ├── FeatureFlowView
│   │   ├── FlowSelector
│   │   └── FlowDiagram (Mermaid or custom SVG)
│   ├── AIAssistantView
│   │   ├── ChatHistory
│   │   └── MessageInput
│   └── DocsView
│       └── DocDownloadList
```

#### API Client (`src/api/client.ts`)

```typescript
uploadRepository(file: File): Promise<{ sessionId: string }>
getSession(sessionId: string): Promise<KnowledgeBase>
ask(sessionId: string, history: Message[], question: string): Promise<AssistantResponse>
getDoc(sessionId: string, type: DocType): Promise<string>
```

---

## Data Models

### `ProjectMetadata`

```typescript
interface ProjectMetadata {
  name: string;
  version: string;
  description: string;
  dependencies: Record<string, string>;
  hasPackageJson: boolean;
}
```

### `Technology`

```typescript
interface Technology {
  name: string;              // "React" | "TypeScript" | "Express" | "Node.js"
  confidence: "high" | "medium" | "low";
  detectedBy: string;        // e.g., "package.json:dependencies" | "file-extension:.tsx"
}
```

### `Module`

```typescript
interface Module {
  id: string;
  name: string;
  rootPath: string;
  files: string[];
  description: string;
  dependencies: string[];    // module IDs this module depends on
}
```

### `Endpoint`

```typescript
interface Endpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | string;
  path: string;
  sourceFile: string;
  lineNumber: number;
  middlewares: string[];
  serviceFunction: string | null;
  serviceFile: string | null;
}
```

### `Component`

```typescript
interface Component {
  id: string;
  name: string;
  filePath: string;
  type: "functional" | "class";
  apiCalls: ApiCallRecord[];
  children: string[];        // component IDs
  parents: string[];         // component IDs
}

interface ApiCallRecord {
  url: string;
  method: string | null;     // null if not determinable statically
}
```

### `Entity`

```typescript
interface Entity {
  id: string;
  name: string;
  ormType: "mongoose" | "sequelize" | "unknown";
  fields: EntityField[];
  relationships: EntityRelationship[];
  sourceFile: string;
}

interface EntityField {
  name: string;
  type: string;
  required: boolean;
}

interface EntityRelationship {
  type: "ref" | "belongsTo" | "hasMany" | "hasOne";
  targetEntity: string;
  field: string;
}
```

### `DependencyGraph`

```typescript
interface DependencyGraph {
  nodes: string[];           // module IDs
  edges: DependencyEdge[];
}

interface DependencyEdge {
  from: string;              // module ID
  to: string;                // module ID
  isCircular: boolean;
}
```

### `FeatureFlow`

```typescript
interface FeatureFlow {
  id: string;
  name: string;
  steps: FlowStep[];
}

interface FlowStep {
  layer: "ui-screen" | "component" | "api-request" | "route" | "controller" | "service" | "database" | "response";
  entityId: string | null;   // refers to component, endpoint, or entity ID
  entityType: "component" | "endpoint" | "entity" | null;
  label: string;
  resolved: boolean;
}
```

### `AnalysisWarning`

```typescript
interface AnalysisWarning {
  code: string;
  message: string;
  file: string | null;
  severity: "info" | "warning" | "error";
}
```

### `Message` (AI Conversation)

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AssistantResponse {
  content: string;
  citations: EntityCitation[];
}

interface EntityCitation {
  entityId: string;
  entityType: "module" | "endpoint" | "component" | "entity";
  label: string;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid ZIP file tree extraction

*For any* valid ZIP archive containing at least one file, the Repository_Engine SHALL produce a non-empty `RepositoryTree` whose `files` array contains an entry for every file in the archive.

**Validates: Requirements 1.1**

---

### Property 2: Non-ZIP input rejection

*For any* file buffer whose magic bytes do not match the ZIP format signature (`PK\x03\x04`), the Repository_Engine SHALL return an error result rather than a RepositoryTree, and the error message SHALL be non-empty.

**Validates: Requirements 1.3**

---

### Property 3: package.json field extraction round-trip

*For any* valid `package.json` object containing `name`, `version`, `description`, and `dependencies`, serializing it and passing it through the Repository_Engine SHALL produce a `ProjectMetadata` whose corresponding fields equal the original values.

**Validates: Requirements 1.4**

---

### Property 4: Technology detection coverage

*For any* repository with a known combination of technology markers (file extensions, package.json dependency entries, tsconfig presence), the Analysis_Engine SHALL detect at least those technologies in its output, and every detected technology SHALL have a non-empty `name` and a valid `confidence` value.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

---

### Property 5: Index-file module detection and completeness

*For any* repository directory containing an `index.js` or `index.ts` file, the Analysis_Engine SHALL produce a `Module` record for that directory, and that record SHALL have non-empty `id`, `name`, `rootPath`, `files`, and `description` fields.

**Validates: Requirements 3.2, 3.3**

---

### Property 6: Dependency graph edge completeness

*For any* pair of modules where one module imports from the other via a relative import statement, the dependency graph in the Knowledge_Base SHALL contain a directed edge from the importing module to the imported module.

**Validates: Requirements 3.5**

---

### Property 7: Express route extraction and endpoint structure completeness

*For any* Express route definition (`app.get`, `router.post`, etc.) present in a source file, the Analysis_Engine SHALL produce an `Endpoint` record containing non-null `id`, `method`, `path`, `sourceFile`, and `lineNumber` fields, and the `middlewares` field SHALL be an array (possibly empty).

**Validates: Requirements 4.1, 4.2, 4.3**

---

### Property 8: React component detection and record completeness

*For any* JSX or TSX file that exports a named functional or class component, the Analysis_Engine SHALL produce a `Component` record with non-empty `id`, `name`, `filePath`, and `type` fields.

**Validates: Requirements 5.1, 5.3**

---

### Property 9: Component API call recording

*For any* React component file that contains a `fetch(url)` or `axios.*(url)` call with a string-literal URL, the resulting `Component` record SHALL include that URL in its `apiCalls` array.

**Validates: Requirements 5.2**

---

### Property 10: Component parent-child relationship recording

*For any* component A that contains an import statement referencing component B within the same repository, the Knowledge_Base SHALL contain a parent-child relationship where A lists B in its `children` array and B lists A in its `parents` array.

**Validates: Requirements 5.4**

---

### Property 11: ORM entity extraction and record completeness

*For any* Mongoose schema definition or Sequelize model definition present in a source file, the Analysis_Engine SHALL produce an `Entity` record with non-empty `id`, `name`, `ormType`, `fields`, and `sourceFile` fields.

**Validates: Requirements 6.1, 6.2, 6.3**

---

### Property 12: Entity relationship recording

*For any* entity definition that declares a relationship (`ref`, `belongsTo`, `hasMany`, `hasOne`), the resulting `Entity` record SHALL include an `EntityRelationship` entry referencing the correct target entity name.

**Validates: Requirements 6.4**

---

### Property 13: Knowledge Base assembly completeness

*For any* set of partial analysis results (including empty sets), the Knowledge_Builder SHALL assemble a `KnowledgeBase` object containing all eight required top-level keys: `metadata`, `technologies`, `modules`, `endpoints`, `components`, `entities`, `dependencyGraph`, and `warnings`.

**Validates: Requirements 7.1, 7.2**

---

### Property 14: Session persistence round-trip

*For any* assembled `KnowledgeBase`, persisting it and then retrieving it by its assigned `sessionId` SHALL return an object whose `sessionId`, `metadata`, `technologies`, `modules`, `endpoints`, `components`, and `entities` fields are deeply equal to the original.

**Validates: Requirements 7.3**

---

### Property 15: Session data isolation

*For any* two sessions with distinct `sessionId` values and distinct repository contents, requesting a view for session A SHALL return data that does not contain entities from session B's Knowledge_Base.

**Validates: Requirements 7.4**

---

### Property 16: Learning Journey progress percentage accuracy

*For any* set of N completed stages out of a total of M stages (where 0 ≤ N ≤ M), the Learning_Journey progress indicator SHALL display exactly `Math.round((N / M) * 100)` percent.

**Validates: Requirements 9.4**

---

### Property 17: AI conversation context window

*For any* conversation of length L messages, the prompt sent to the LLM SHALL include the content of the last `min(L, 10)` messages in the conversation history.

**Validates: Requirements 12.5**

---

### Property 18: Documentation generation completeness

*For any* Knowledge_Base, calling each documentation generator function SHALL return a non-empty Markdown string, and the README output SHALL contain the project name and technology stack, the architecture summary SHALL contain module names, the API docs output SHALL list all endpoints (or a "no endpoints" notice when the list is empty), and the learning guide SHALL contain all eight Learning_Journey stage names.

**Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

---

### Property 19: Analyzer invocation coverage

*For any* valid `Analyzer` implementation whose `detect()` method returns `true`, registering it with the Analysis_Engine and running the pipeline SHALL result in `analyze()` being called exactly once.

**Validates: Requirements 14.1, 14.2**

---

### Property 20: Analyzer skip and fault isolation

*For any* set of analyzers where some have `detect()` returning `false` and some throw during `analyze()`, the Analysis_Engine SHALL (a) never call `analyze()` on skipped analyzers, (b) record a warning for each throwing analyzer, and (c) return results from all non-throwing, non-skipped analyzers.

**Validates: Requirements 14.4, 14.5**

---

## Error Handling

### Upload Errors

| Condition | HTTP Status | Error Code | Behavior |
|---|---|---|---|
| File not ZIP | 400 | `INVALID_FORMAT` | Reject, return descriptive message |
| File > 200 MB | 400 | `FILE_TOO_LARGE` | Reject, return size limit message |
| No file attached | 400 | `NO_FILE` | Reject |
| Extraction failure | 422 | `EXTRACTION_FAILED` | Return error with details |

### Analysis Errors

| Condition | Behavior |
|---|---|
| Analyzer `detect()` returns false | Skip silently |
| Analyzer `analyze()` throws | Catch exception, record `AnalysisWarning`, continue |
| No `package.json` found | Set `metadata.hasPackageJson = false`, continue |
| No routes/components/entities found | Store empty lists, set layer-absent flags |
| KB assembly throws | Preserve partial results, return `500` with partial KB and error |

### Session Errors

| Condition | HTTP Status | Behavior |
|---|---|---|
| Unknown `sessionId` | 404 | Return `SESSION_NOT_FOUND` error |
| Expired session | 410 | Return `SESSION_EXPIRED` error |

### AI Assistant Errors

| Condition | Behavior |
|---|---|
| LLM API unavailable | Return user-facing error message, do not crash session |
| LLM rate limit | Retry once after 1 second, then surface error |
| KB context exceeds LLM token limit | Truncate by dropping older sections (warnings first, then dependency edges) |

---

## Testing Strategy

### Unit Tests

- `RepositoryEngine`: ZIP extraction, size validation, package.json parsing
- Each `Analyzer`: route detection, component detection, schema detection using synthetic source file strings
- `KnowledgeBuilder`: assembly completeness, session store persistence and retrieval
- `DocumentationGenerator`: output contains required sections for various KB shapes
- `AIAssistantService.buildPrompt`: history window slicing, KB serialization

### Property-Based Tests

The project uses **[fast-check](https://github.com/dubzzz/fast-check)** as the property-based testing library (TypeScript-native, no extra setup needed in a Node/Jest environment).

Each property test runs a **minimum of 100 iterations** via fast-check's default configuration.

Every property test is tagged with a comment in the format:
`// Feature: codebase-understanding-platform, Property N: <property title>`

| Property | Test File | Generator Strategy |
|---|---|---|
| P1: ZIP extraction | `repo-engine.property.test.ts` | Generate in-memory ZIP buffers with random file entries |
| P2: Non-ZIP rejection | `repo-engine.property.test.ts` | Generate random byte buffers without ZIP magic bytes |
| P3: package.json round-trip | `repo-engine.property.test.ts` | Generate random `{name, version, description, dependencies}` objects |
| P4: Technology detection | `tech-analyzer.property.test.ts` | Generate repo trees with random subsets of tech markers |
| P5: Module detection & structure | `module-analyzer.property.test.ts` | Generate directory trees with random numbers of index files |
| P6: Dependency graph edges | `module-analyzer.property.test.ts` | Generate modules with known import chains, verify edge set |
| P7: Route extraction & structure | `express-analyzer.property.test.ts` | Generate Express source file strings with random routes |
| P8: Component detection & structure | `react-analyzer.property.test.ts` | Generate JSX/TSX source strings with random component names |
| P9: API call recording | `react-analyzer.property.test.ts` | Generate components with random fetch/axios URLs |
| P10: Parent-child relationships | `react-analyzer.property.test.ts` | Generate component import chains |
| P11: Entity extraction & structure | `db-analyzer.property.test.ts` | Generate Mongoose/Sequelize definition strings |
| P12: Entity relationship recording | `db-analyzer.property.test.ts` | Generate entity definitions with random relationship types |
| P13: KB assembly completeness | `knowledge-builder.property.test.ts` | Generate random sets of partial results |
| P14: Session persistence round-trip | `knowledge-builder.property.test.ts` | Generate KBs, persist, retrieve, deep-equal compare |
| P15: Session isolation | `knowledge-builder.property.test.ts` | Generate two distinct KBs, verify no cross-contamination |
| P16: Progress percentage | `learning-journey.property.test.ts` | Generate integers 0 ≤ N ≤ M ≤ 8 |
| P17: Conversation context window | `ai-assistant.property.test.ts` | Generate message arrays of varying length (1–15) |
| P18: Documentation completeness | `docs-generator.property.test.ts` | Generate KBs with various combinations of data presence |
| P19: Analyzer invocation | `analysis-engine.property.test.ts` | Generate mock analyzer arrays |
| P20: Analyzer skip & fault isolation | `analysis-engine.property.test.ts` | Generate mixed arrays of valid, skipping, and throwing analyzers |

### Integration Tests

- Upload endpoint: multipart upload with a real small ZIP fixture
- Full pipeline: upload → analysis → KB retrieval
- AI endpoint: mocked LLM, verify prompt structure and response parsing
- Documentation download endpoints: verify correct `Content-Disposition` headers

### Frontend Tests

- React Testing Library unit tests for each view component with mocked API responses
- Snapshot tests for DocumentationGenerator Markdown output
