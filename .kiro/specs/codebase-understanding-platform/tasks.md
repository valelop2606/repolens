# Implementation Plan: Codebase Understanding Platform

## Overview

Implement the Codebase Understanding Platform incrementally: project scaffolding → analysis pipeline → Knowledge Base → backend API → frontend views → AI Assistant → Documentation Generator. Each task builds on the previous and ends with all code integrated and testable.

The implementation language is **TypeScript** using **NestJS** (backend) and **React + Vite** (frontend).

---

## Tasks

- [x] 1. Project scaffolding and shared types
  - Create monorepo structure with `backend/` and `frontend/` directories
  - Initialize `backend/` as a NestJS project with `tsconfig.json`, `package.json`, Jest config, and `nest-cli.json`
  - Initialize `frontend/` as a Vite + React + TypeScript project
  - Define all shared TypeScript interfaces in `backend/src/shared/types/index.ts`: `RepositoryTree`, `FileEntry`, `PartialAnalysisResult`, `KnowledgeBase`, `ProjectMetadata`, `Technology`, `Module`, `Endpoint`, `Component`, `Entity`, `DependencyGraph`, `FeatureFlow`, `AnalysisWarning`, `Message`, `AssistantResponse`, `EntityCitation`, `AnalysisStatus`
  - Install backend dependencies: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/mongoose`, `mongoose`, `adm-zip`, `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `uuid`, `class-validator`, `class-transformer`, `fast-check` (dev)
  - Install frontend dependencies: `axios`, `react-router-dom`, `react-force-graph-2d`
  - Configure `SharedModule` as `@Global` with `StorageService` (AWS S3 abstraction) and `aws.config` exported
  - _Requirements: 7.2, 14.3_

- [x] 2. Repository Engine (RepositoryLoader)
  - [x] 2.1 Implement `RepositoryLoader` in `backend/src/modules/analysis/pipeline/repository-loader.ts`
    - Validate ZIP magic bytes (`PK\x03\x04`) and reject non-ZIP buffers with `INVALID_FORMAT` error via `RepositoryLoaderError`
    - Validate file size ≤ 200 MB and reject oversized uploads with `FILE_TOO_LARGE` error
    - Extract ZIP contents using `adm-zip`, build `FileEntry[]` from all extracted paths, contents, and extensions
    - Detect repository root path from common first path segment of all entries
    - Locate and parse `package.json` at the repository root; return `null` if absent or invalid JSON
    - Return a `RepositoryTree` with `rootPath`, `files`, and `packageJson`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Write property tests for RepositoryLoader
    - **Property 1: Valid ZIP file tree extraction** — generate in-memory ZIP buffers with random file sets, verify `files` array matches
    - **Property 2: Non-ZIP rejection** — generate random byte arrays, verify `RepositoryLoaderError` with code `INVALID_FORMAT` is thrown
    - **Property 3: package.json round-trip** — generate random `{name, version, description, dependencies}`, verify extraction round-trip
    - `// Feature: codebase-understanding-platform, Property 1, 2, 3`
    - _Requirements: 1.1, 1.3, 1.4_

- [x] 3. Analyzer interface and AnalysisEngine
  - [x] 3.1 Define the `Analyzer` interface in `backend/src/modules/analysis/interfaces/analyzer.interface.ts`
    - Interface must declare `readonly name: string`, `detect(repo: RepositoryTree): boolean`, and `analyze(repo: RepositoryTree): Promise<PartialAnalysisResult>`
    - _Requirements: 14.3_

  - [x] 3.2 Implement `AnalysisEngine` in `backend/src/modules/analysis/pipeline/analysis-engine.ts`
    - Accept an array of `Analyzer` implementations at construction time
    - For each analyzer: call `detect()`; if false, skip with a debug log; if true, call `analyze()` in a try/catch
    - On exception: append an `AnalysisWarning` with code `ANALYZER_ERROR` and continue to the next analyzer
    - Return the array of all `PartialAnalysisResult` objects (including those with only warnings)
    - _Requirements: 14.1, 14.2, 14.4, 14.5_

  - [x] 3.3 Write property tests for AnalysisEngine
    - **Property 19: Analyzer invocation coverage** — generate mock analyzers with `detect()=true`, verify `analyze()` called once each
    - **Property 20: Analyzer skip and fault isolation** — generate mixed sets of skipping/throwing/valid analyzers, verify correct result count and warning injection
    - `// Feature: codebase-understanding-platform, Property 19, 20`
    - _Requirements: 14.2, 14.4, 14.5_


- [x] 4. Technology Detection Analyzer
  - Implement `TechDetectionAnalyzer` in `backend/src/modules/analysis/analyzers/tech-detection.analyzer.ts`
  - `detect()` always returns `true` (applicable to all repos)
  - `analyze()` inspects `packageJson.dependencies` + `devDependencies`, file extensions (`.tsx`, `.ts`, `.py`, `.java`), and presence of config files (`tsconfig.json`, `vite.config.ts`, `nest-cli.json`) to produce a `Technology[]`
  - Assign `confidence: "high"` when found in `package.json` dependencies, `"medium"` for file-extension or config-file evidence
  - Store `detectedBy` string describing the detection source; deduplicate by tech name
  - Detect AWS Bedrock (`@aws-sdk/client-bedrock-runtime`) and AWS S3 (`@aws-sdk/client-s3`) as first-class technologies
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.1 Write property tests for TechDetectionAnalyzer
    - **Property 4: Technology detection coverage** — generate `RepositoryTree` objects with random subsets of known dependency markers, verify detected set is correct and every entry has valid `name` and `confidence`
    - `// Feature: codebase-understanding-platform, Property 4`
    - _Requirements: 2.1–2.5_

- [x] 5. Module Analyzer
  - Implement `ModuleAnalyzer` in `backend/src/modules/analysis/analyzers/module.analyzer.ts`
  - `detect()` returns `true` if any files exist
  - `analyze()` groups files by top-level directory; treats directories containing `index.ts` or `index.js` as module boundaries
  - For each module: assign a generated `id` (UUID), `name` (directory name), `rootPath`, `files` list, and auto-generated `description` (template: "Module handling <name> functionality")
  - Compute inter-module import edges by scanning `import` / `require` statements for relative paths crossing module boundaries; flag circular edges
  - Return `modules`, `dependencyEdges`, and circular dependency `warnings`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 5.1 Write property tests for ModuleAnalyzer
    - **Property 5: Index-file module detection and completeness** — generate directory trees with random numbers of index files, verify a module record exists for each with all required fields
    - **Property 6: Dependency graph edge completeness** — generate file trees with known import chains, verify edges are present
    - `// Feature: codebase-understanding-platform, Property 5, 6`
    - _Requirements: 3.2, 3.3, 3.5_

- [ ] 6. NestJS Endpoint Analyzer
  - Implement `NestjsEndpointAnalyzer` in `backend/src/modules/analysis/analyzers/nestjs-endpoint.analyzer.ts`
  - `detect()` returns `true` when `@nestjs/common` is in `packageJson.dependencies`
  - `analyze()` scans source files for NestJS controller decorators: `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`
  - Extract HTTP method, path string, source file, approximate line number, and guard/interceptor decorator names as `middlewares`
  - When the handler delegates to an identifiable service method call, record `serviceFunction` and `serviceFile`
  - Also support Express patterns (`app.METHOD`, `router.METHOD`) as a fallback when `express` is in dependencies
  - If no routes found, return empty `endpoints` array
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 6.1 Write property tests for NestjsEndpointAnalyzer
    - **Property 7: Route extraction and endpoint structure completeness** — generate NestJS controller source strings with random route definitions, verify each produces a complete `Endpoint` record
    - `// Feature: codebase-understanding-platform, Property 7`
    - _Requirements: 4.1–4.3_

- [ ] 7. React Component Analyzer
  - Implement `ReactComponentAnalyzer` in `backend/src/modules/analysis/analyzers/react-component.analyzer.ts`
  - `detect()` returns `true` when JSX or TSX files exist
  - `analyze()` scans JSX/TSX files for exported functional components (arrow functions and `function` declarations) and class components extending `React.Component`
  - For each component: record `name`, `filePath`, `type`
  - Scan `import` statements to build parent-child relationships between components
  - Detect `fetch(url)`, `axios.*(url)`, and Axios client calls with string-literal URLs; record in `apiCalls`
  - Skip files with no recognizable component exports without recording errors
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 7.1 Write property tests for ReactComponentAnalyzer
    - **Property 8: Component detection and record completeness** — generate JSX/TSX source strings with random component names and types, verify records have all required fields
    - **Property 9: API call recording** — generate components with random fetch/axios URLs, verify URL appears in `apiCalls`
    - **Property 10: Parent-child relationship recording** — generate chains of component imports, verify bidirectional relationship entries
    - `// Feature: codebase-understanding-platform, Property 8, 9, 10`
    - _Requirements: 5.1–5.4_

- [ ] 8. Database Entity Analyzer
  - Implement `DatabaseEntityAnalyzer` in `backend/src/modules/analysis/analyzers/database-entity.analyzer.ts`
  - `detect()` returns `true` when `mongoose` or `sequelize` appear in `packageJson.dependencies`
  - `analyze()` scans source files for Mongoose `@Schema` / `new Schema({...})` and Sequelize model definitions
  - Extract schema/model name, field names, types, and `required` flags
  - Detect Mongoose `ref` fields and Sequelize `belongsTo`/`hasMany`/`hasOne` calls; record as `EntityRelationship`
  - If no models found, return empty `entities` array
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 8.1 Write property tests for DatabaseEntityAnalyzer
    - **Property 11: ORM entity extraction and record completeness** — generate Mongoose schema strings with random field sets, verify entity records have all required fields
    - **Property 12: Entity relationship recording** — generate entity definitions with random relationship declarations, verify each relationship appears in the output
    - `// Feature: codebase-understanding-platform, Property 11, 12`
    - _Requirements: 6.1–6.4_

- [ ] 9. Checkpoint — Ensure all analyzer unit and property tests pass
  - Run `npm test` in `backend/` and verify all tests pass; ask the user if any questions arise


- [ ] 10. KnowledgeBuilder and MongoDB persistence
  - [ ] 10.1 Implement `KnowledgeBuilder` in `backend/src/modules/analysis/pipeline/knowledge-builder.ts`
    - `assemble(partials, repo, projectId)`: merge all partial results into a single `KnowledgeBase`; set layer-absent behavior when endpoint/component/entity lists are empty; derive `metadata` from `repo.packageJson`; generate a UUID `sessionId`; set `createdAt` to `new Date()`
    - Wrap `assemble` in try/catch; on fatal error, throw with error details
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 10.2 Implement `KnowledgeService` in `backend/src/modules/knowledge/knowledge.service.ts`
    - Inject Mongoose `Model<KnowledgeBaseDocument>` using `@InjectModel`
    - `save(kb)`: persist KB to MongoDB `knowledge_base` collection; return saved document
    - `findBySession(sessionId)`: query by `sessionId`; throw `NotFoundException` if not found; use `.lean()` for read performance
    - `findByProject(projectId)`: query by `projectId`; throw `NotFoundException` if not found
    - `getModules`, `getEndpoints`, `getComponents`, `getEntities`: convenience methods returning sub-arrays from the KB
    - _Requirements: 7.3, 7.4_

  - [ ] 10.3 Write property tests for KnowledgeBuilder
    - **Property 13: KB assembly completeness** — generate random sets of partial results, verify assembled KB has all top-level keys with correct types
    - **Property 14: Metadata extraction** — generate `RepositoryTree` with random `package.json` content, verify `metadata.name`, `version`, `description`, and `hasPackageJson` are correctly derived
    - **Property 15: Session isolation** — verify two `assemble` calls produce different `sessionId` UUIDs
    - `// Feature: codebase-understanding-platform, Property 13, 14, 15`
    - _Requirements: 7.1–7.4_

- [ ] 11. Projects module and analysis pipeline wiring
  - [ ] 11.1 Implement `ProjectsService` in `backend/src/modules/projects/projects.service.ts`
    - Inject `Model<ProjectDocument>` using `@InjectModel`
    - `create(dto)`: create a project with `status: "pending"`, empty `technologies`, `null` for `s3UploadKey`, `knowledgeBaseId`, `errorMessage`
    - `findAll()`: return all projects sorted by `createdAt` descending
    - `findOne(id)`: find by MongoDB ObjectId; throw `NotFoundException` if absent
    - `updateStatus(id, status, extras)`: update `status` and any optional fields (`s3UploadKey`, `knowledgeBaseId`, `technologies`, `errorMessage`)
    - `delete(id)`: hard delete; throw `NotFoundException` if absent
    - _Requirements: 8.1, 8.2_

  - [ ] 11.2 Implement `AnalysisService` in `backend/src/modules/analysis/analysis.service.ts`
    - Orchestrate the full pipeline: `RepositoryLoader` → `AnalysisEngine` → `KnowledgeBuilder` → `KnowledgeService.save()`
    - Mark project `processing` before analysis starts; `completed` (with `knowledgeBaseId` and `technologies`) on success; `failed` (with `errorMessage`) on exception
    - Re-throw `RepositoryLoaderError` as NestJS `BadRequestException` with `{ code, message }` body
    - Register `TechDetectionAnalyzer` in the `AnalysisEngine` constructor; add a comment noting where future analyzers are registered
    - _Requirements: 1.1–1.5, 7.3_

  - [ ] 11.3 Implement REST controllers
    - `ProjectsController` (`@Controller('projects')`): `POST /api/projects` → create; `GET /api/projects` → list; `GET /api/projects/:id` → single; `DELETE /api/projects/:id` → remove
    - `AnalysisController` (`@Controller('projects/:projectId/analyze')`): `POST /api/projects/:projectId/analyze` — accept multipart `repository` field (ZIP, 200 MB limit via `FileInterceptor` + `ParseFilePipe`); call `AnalysisService.analyzeRepository()`; return `{ sessionId, projectId }` with HTTP 202
    - `KnowledgeController` (`@Controller('sessions')`): `GET /api/sessions/:id` → full KB; `GET /api/sessions/:id/modules`; `GET /api/sessions/:id/endpoints`; `GET /api/sessions/:id/components`; `GET /api/sessions/:id/entities`
    - All business logic stays in services; controllers handle HTTP concerns only
    - _Requirements: 1.1–1.5, 7.3, 7.4_

- [ ] 12. AWS S3 storage abstraction
  - Implement `StorageService` in `backend/src/shared/services/storage.service.ts`
    - Inject `ConfigService` to read `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
    - `upload(key, buffer, contentType)`: upload buffer to S3 using `PutObjectCommand`; return the S3 key
    - `getSignedUrl(key, expiresInSeconds)`: generate a presigned `GetObjectCommand` URL
    - `delete(key)`: delete an S3 object using `DeleteObjectCommand`
    - Isolate all AWS SDK calls inside this service; no other service calls S3 directly
    - Define `aws.config` in `backend/src/shared/config/aws.config.ts` using `registerAs` from `@nestjs/config`
    - _Requirements: (AWS S3 rule from engineering standards)_

- [ ] 13. Documentation module
  - [ ] 13.1 Implement `DocumentationGenerator` in `backend/src/modules/documentation/documentation.generator.ts`
    - `generateReadme(kb)`: produce Markdown with project name, description, technology stack badges, and module list
    - `generateArchitectureSummary(kb)`: produce Markdown listing all modules with their descriptions and dependency edges
    - `generateApiDocs(kb)`: produce Markdown table of all endpoints (method, path, middleware, service); emit "No endpoints detected" section when list is empty
    - `generateLearningGuide(kb)`: produce Markdown with all eight Learning Journey stages as sections populated from the KB
    - All methods return `string`; no async required
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ] 13.2 Create `DocumentationModule` and controller
    - Wire `DocumentationGenerator` as a provider in `DocumentationModule`
    - Import `KnowledgeModule` to access `KnowledgeService`
    - `DocumentationController` (`@Controller('sessions/:id/docs')`):
      - `GET /api/sessions/:id/docs/readme` → `generateReadme`
      - `GET /api/sessions/:id/docs/architecture` → `generateArchitectureSummary`
      - `GET /api/sessions/:id/docs/api` → `generateApiDocs`
      - `GET /api/sessions/:id/docs/learning-guide` → `generateLearningGuide`
    - Each route sets `Content-Type: text/markdown` and `Content-Disposition: attachment; filename=<type>.md`
    - Register `DocumentationModule` in `AppModule`
    - _Requirements: 13.5_

  - [ ] 13.3 Write property tests for DocumentationGenerator
    - **Property 18: Documentation generation completeness** — generate KBs with random combinations of data presence/absence, verify each generator returns a non-empty string containing required section headers
    - `// Feature: codebase-understanding-platform, Property 18`
    - _Requirements: 13.1–13.5_


- [ ] 14. AI Assistant (AWS Bedrock)
  - [ ] 14.1 Implement `ChatService` in `backend/src/modules/chat/chat.service.ts`
    - Inject `ConfigService` and `KnowledgeService`
    - Use `BedrockRuntimeClient` from `@aws-sdk/client-bedrock-runtime` (inject client for testability)
    - `buildPrompt(kb, history, question)`: serialize relevant KB sections (technologies, modules, endpoints, components, entities) as JSON into a system prompt; append the last `Math.min(history.length, 10)` messages as conversation history; append the new user question
    - `ask(sessionId, history, question)`: retrieve KB via `KnowledgeService.findBySession()` → build prompt → call Bedrock `InvokeModelCommand` (model: `anthropic.claude-3-haiku-20240307-v1:0`) → parse response → extract entity name mentions and construct `EntityCitation[]` → return `AssistantResponse`
    - On Bedrock error: return a structured error message (do not throw); log the error
    - `saveHistory(sessionId, projectId, messages)`: persist conversation to `ChatHistory` MongoDB collection
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 14.2 Create `ChatModule` and controller
    - Wire `ChatService` and `ChatHistory` Mongoose schema in `ChatModule`
    - Import `KnowledgeModule` to expose `KnowledgeService`
    - `ChatController` (`@Controller('sessions/:id/chat')`):
      - `POST /api/sessions/:id/chat/ask`: accept `{ history: Message[], question: string }` body; call `ChatService.ask()`; return `AssistantResponse`
      - `GET /api/sessions/:id/chat/history`: return saved chat history for the session
    - Register `ChatModule` in `AppModule`
    - _Requirements: 12.1_

  - [ ] 14.3 Write property tests for ChatService
    - **Property 17: Conversation context window** — generate message arrays of length 1–15, verify `buildPrompt` includes exactly `min(length, 10)` messages in the prompt string
    - `// Feature: codebase-understanding-platform, Property 17`
    - _Requirements: 12.5_

- [ ] 15. Checkpoint — Ensure all backend tests pass, server starts, and all routes respond correctly
  - Run `npm test` in `backend/`; verify all tests pass
  - Start the server and verify `POST /api/projects`, `POST /api/projects/:id/analyze`, `GET /api/sessions/:id` return expected responses
  - Ask the user if any questions arise

- [ ] 16. React frontend — API client, session context, and upload page
  - Create `frontend/src/features/upload/services/api.client.ts` with typed Axios functions: `createProject(name, description)`, `uploadRepository(projectId, file, onProgress)`, `getSession(sessionId)`, `askQuestion(sessionId, history, question)`, `getDoc(sessionId, type)`
  - Create a `SessionContext` (React context) in `frontend/src/features/upload/context/SessionContext.tsx` that holds the active `KnowledgeBase` and `sessionId`
  - Implement `UploadPage` in `frontend/src/features/upload/pages/UploadPage.tsx` with a drag-and-drop file input (accept `.zip` only), project name field, upload progress indicator, and error display
  - On successful upload: store `sessionId` in `localStorage`, navigate to `/session/:id/understand`
  - Implement `SessionLayout` that fetches the KB on mount and renders a sidebar navigation + `<Outlet />`
  - _Requirements: 1.1, 7.4_

- [ ] 17. Understand View (Dashboard)
  - Implement `UnderstandView` in `frontend/src/features/dashboard/pages/UnderstandView.tsx`
  - Display project name, version, description from `kb.metadata`
  - Render technology stack as badge chips using `kb.technologies` (color-coded by `confidence`)
  - Render module list with auto-generated descriptions from `kb.modules`
  - Render an interactive dependency graph using `react-force-graph-2d` (nodes = modules, edges = dependency edges, circular edges styled in red)
  - Display warning panel listing `kb.warnings` if non-empty
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 18. Learning Journey View
  - Implement `LearningJourneyView` in `frontend/src/features/journey/pages/LearningJourneyView.tsx`
  - Hardcode the eight ordered stages: Project Overview → Architecture → Business Modules → Authentication → Core Features → API → Database → Ready for your first task
  - Track completed stages in component state (or `localStorage` for persistence)
  - For each stage, map it to the corresponding KB section and render relevant data; display an informational message when the layer is absent
  - Display a progress bar showing `Math.round((completed / total) * 100)%`
  - Clicking a stage marks it as completed and advances the progress indicator
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 18.1 Write unit tests for Learning Journey progress calculation
    - **Property 16: Progress percentage accuracy** — generate integers 0 ≤ N ≤ 8, verify progress display matches `Math.round((N / 8) * 100)`
    - `// Feature: codebase-understanding-platform, Property 16`
    - _Requirements: 9.4_

- [ ] 19. Explorer View
  - Implement `ExplorerView` in `frontend/src/features/explore/pages/ExplorerView.tsx`
  - Left sidebar with collapsible sections: Frontend (Components), Backend (Endpoints), Database (Entities), Architecture (Modules)
  - Clicking a list item opens an `EntityDetail` panel on the right showing all fields from the data model
  - Component detail: name, file path, type, parent-child list (each is a navigable link), API calls list
  - Endpoint detail: HTTP method badge, path, source file, line number, middleware list, service function link
  - Entity detail: name, ORM type, fields table (name/type/required), relationships list
  - Module detail: name, root path, file count, description, dependency list
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 20. Feature Flow Tracer View
  - Implement `FeatureFlowView` in `frontend/src/features/explore/pages/FeatureFlowView.tsx`
  - `FlowSelector` dropdown populated from `kb.components` (filter to page/screen components) and `kb.endpoints`
  - On selection, construct a `FeatureFlow` by resolving the path: Component → API call URL match → Endpoint → Service → Entity; mark steps as unresolved if the link cannot be established
  - Render the flow as a vertical step diagram; each resolved step is a navigable link that opens the matching entity in the Explorer
  - Highlight the associated source file and line number in a code snippet panel when a step is clicked
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 21. AI Assistant View
  - Implement `AIAssistantView` in `frontend/src/features/chat/pages/AIAssistantView.tsx`
  - `ChatHistory` renders messages with role-based styling; citations rendered as hyperlinks navigating to the Explorer entity
  - `MessageInput` text area with submit on Enter (Shift+Enter for newline)
  - On submit: append user message to local history, call `api.askQuestion(sessionId, history, question)`, append assistant response
  - Show loading spinner while awaiting response; show error banner on API failure
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 22. Documentation Download View
  - Implement `DocsView` in `frontend/src/features/documentation/pages/DocsView.tsx`
  - Four download buttons: README, Architecture Summary, API Docs, Learning Guide
  - Each button calls `api.getDoc(sessionId, type)` and triggers a browser file download using a Blob URL
  - _Requirements: 13.1–13.5_

- [ ] 23. Wire everything together and final integration
  - [ ] 23.1 Add React Router routes in `frontend/src/App.tsx`
    - `/` → `UploadPage`
    - `/session/:id` → `SessionLayout` with nested routes for each view
    - Default redirect from `/session/:id` to `/session/:id/understand`
    - _Requirements: 7.4_

  - [ ] 23.2 Register all analyzers in `AnalysisService`
    - Instantiate and pass `TechDetectionAnalyzer`, `ModuleAnalyzer`, `NestjsEndpointAnalyzer`, `ReactComponentAnalyzer`, `DatabaseEntityAnalyzer` to `AnalysisEngine`
    - _Requirements: 14.1, 14.2_

  - [ ] 23.3 Write backend integration tests
    - Upload a fixture ZIP containing a small NestJS + React + Mongoose sample project
    - Verify session is created; KB contains expected technologies, modules, endpoints, components, and entities
    - Verify all four documentation download routes return `Content-Type: text/markdown` with correct `Content-Disposition` headers
    - _Requirements: 1.1, 7.3, 13.5_

- [ ] 24. Final checkpoint — Ensure all tests pass
  - Run `npm test` in `backend/`; verify all tests pass; ask the user if any questions arise


---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["4", "4.1", "5", "5.1", "6", "6.1", "7", "7.1", "8", "8.1"] },
    { "id": 3, "tasks": ["9"] },
    { "id": 4, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 5, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 6, "tasks": ["12"] },
    { "id": 7, "tasks": ["13.1", "13.2", "13.3", "14.1", "14.2", "14.3"] },
    { "id": 8, "tasks": ["15"] },
    { "id": 9, "tasks": ["16", "17", "18", "18.1", "19", "20", "21", "22"] },
    { "id": 10, "tasks": ["23.1", "23.2", "23.3"] },
    { "id": 11, "tasks": ["24"] }
  ]
}
```

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests use `fast-check` with default 100-iteration runs
- Each property test file contains a comment `// Feature: codebase-understanding-platform, Property N: <title>` for traceability back to the design document
- MongoDB is used for persistent storage of projects, knowledge bases, and chat history — no in-memory session store
- AWS Bedrock (`anthropic.claude-3-haiku-20240307-v1:0`) handles AI responses; the AI receives the assembled KB as context, never raw repository files
- AWS S3 is used for repository file storage; all S3 interactions must go through `StorageService` — never call the AWS SDK directly in domain modules
- The frontend uses `react-force-graph-2d` for interactive dependency graphs; a plain list fallback is shown if the library fails to load
- The `DocumentationModule` must be registered in `AppModule` (it is already imported in `app.module.ts` but the module files need to be created)
- New analyzers (e.g., `SpringBootAnalyzer`, `DjangoAnalyzer`) can be added by implementing the `Analyzer` interface and registering in `AnalysisService` — no changes to `AnalysisEngine` required
- Environment variables required: `MONGODB_URI`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `FRONTEND_URL`, `PORT`
