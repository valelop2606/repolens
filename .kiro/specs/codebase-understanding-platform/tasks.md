# Implementation Plan: Codebase Understanding Platform

## Overview

Implement the Codebase Understanding Platform incrementally: project scaffolding → analysis pipeline → Knowledge Base → backend API → frontend views → AI Assistant → Documentation Generator. Each task builds on the previous and ends with all code integrated and testable.

The implementation language is **TypeScript** (Node.js + Express backend, React + TypeScript frontend).

---

## Tasks

- [x] 1. Project scaffolding and shared types
  - Create monorepo structure with `backend/` and `frontend/` directories
  - Initialize `backend/` as a Node.js/TypeScript project (`tsconfig.json`, `package.json`, Jest config)
  - Initialize `frontend/` as a Vite + React + TypeScript project
  - Define all shared TypeScript interfaces in `backend/src/types/index.ts`: `RepositoryTree`, `FileEntry`, `PartialAnalysisResult`, `KnowledgeBase`, `ProjectMetadata`, `Technology`, `Module`, `Endpoint`, `Component`, `Entity`, `DependencyGraph`, `FeatureFlow`, `AnalysisWarning`, `Message`, `AssistantResponse`, `EntityCitation`
  - Install backend dependencies: `express`, `adm-zip`, `openai`, `uuid`, `cors`, `multer`, `fast-check` (dev)
  - Install frontend dependencies: `axios`, `react-router-dom`, `d3` (or `react-force-graph`)
  - _Requirements: 7.2, 14.3_

- [-] 2. Repository Engine
  - [x] 2.1 Implement `RepositoryEngine` in `backend/src/engine/repository-engine.ts`
    - Validate ZIP magic bytes and reject non-ZIP buffers with `INVALID_FORMAT` error
    - Validate file size ≤ 200 MB and reject oversized uploads with `FILE_TOO_LARGE` error
    - Extract ZIP contents using `adm-zip`, build `FileEntry[]` from all extracted paths and contents
    - Locate and parse `package.json` at the repository root; set `hasPackageJson = false` if absent
    - Return a `RepositoryTree` with `rootPath`, `files`, and `packageJson`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 2.2 Write property tests for Repository Engine
    - **Property 1: Valid ZIP file tree extraction** — generate in-memory ZIP buffers with random file sets, verify `files` array matches
    - **Property 2: Non-ZIP rejection** — generate random byte arrays, verify error returned
    - **Property 3: package.json round-trip** — generate random `{name, version, description, dependencies}`, verify extraction
    - `// Feature: codebase-understanding-platform, Property 1, 2, 3`
    - _Requirements: 1.1, 1.3, 1.4_

- [ ] 3. Analyzer interface and Analysis Engine
  - [ ] 3.1 Define the `Analyzer` interface in `backend/src/analyzers/analyzer.interface.ts`
    - Interface must declare `name: string`, `detect(repo: RepositoryTree): boolean`, and `analyze(repo: RepositoryTree): Promise<PartialAnalysisResult>`
    - _Requirements: 14.3_

  - [ ] 3.2 Implement `AnalysisEngine` in `backend/src/engine/analysis-engine.ts`
    - Accept an array of `Analyzer` implementations at construction time
    - For each analyzer: call `detect()`; if false, skip without error; if true, call `analyze()` in a try/catch
    - On exception: append an `AnalysisWarning` and continue to the next analyzer
    - Return the array of all successful `PartialAnalysisResult` objects
    - _Requirements: 14.1, 14.2, 14.4, 14.5_

  - [ ]* 3.3 Write property tests for Analysis Engine
    - **Property 19: Analyzer invocation coverage** — generate mock analyzers with detect()=true, verify analyze() called once each
    - **Property 20: Analyzer skip and fault isolation** — generate mixed sets of skipping/throwing/valid analyzers, verify correct behavior
    - `// Feature: codebase-understanding-platform, Property 19, 20`
    - _Requirements: 14.2, 14.4, 14.5_

- [ ] 4. Technology Detection Analyzer
  - Implement `TechDetectionAnalyzer` in `backend/src/analyzers/tech-detection.analyzer.ts`
  - `detect()` always returns `true` (applicable to all repos)
  - `analyze()` inspects `packageJson.dependencies`, file extensions (`.tsx`, `.ts`), and presence of `tsconfig.json` to produce a `Technology[]`
  - Assign `confidence: "high"` when found in `package.json` dependencies, `"medium"` for file-extension evidence only
  - Store `detectedBy` string describing the detection source
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.1 Write property tests for Technology Detection Analyzer
    - **Property 4: Technology detection coverage** — generate `RepositoryTree` objects with random subsets of markers, verify detected set is correct and every entry has valid `name` and `confidence`
    - `// Feature: codebase-understanding-platform, Property 4`
    - _Requirements: 2.1–2.5_

- [ ] 5. Module Analyzer
  - Implement `ModuleAnalyzer` in `backend/src/analyzers/module.analyzer.ts`
  - `detect()` returns true if any files exist
  - `analyze()` groups files by top-level directory; treats directories containing `index.js` or `index.ts` as module boundaries
  - For each module: assign a generated `id`, `name` (directory name), `rootPath`, `files` list, and a one-line auto-generated `description` (template: "Module handling <name> functionality")
  - Compute inter-module import edges by scanning `import` / `require` statements for relative paths crossing module boundaries; flag circular edges
  - Return `modules`, `dependencyEdges`, and circular dependency `warnings`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.1 Write property tests for Module Analyzer
    - **Property 5: Index-file module detection and completeness** — generate directory trees with random numbers of index files, verify a module record exists for each with all required fields
    - **Property 6: Dependency graph edge completeness** — generate file trees with known import chains, verify edges are present
    - `// Feature: codebase-understanding-platform, Property 5, 6`
    - _Requirements: 3.2, 3.3, 3.5_

- [ ] 6. Express Endpoint Analyzer
  - Implement `ExpressEndpointAnalyzer` in `backend/src/analyzers/express-endpoint.analyzer.ts`
  - `detect()` returns true when Express is in `packageJson.dependencies`
  - `analyze()` scans source files for Express route patterns: `app.METHOD(path, ...)`, `router.METHOD(path, ...)`
  - Extract HTTP method, path string, source file, approximate line number, and middleware function names from the argument list
  - When the final handler calls an identifiable service function (e.g., `serviceModule.functionName()`), record `serviceFunction` and `serviceFile`
  - If no routes found, return empty `endpoints` array (backend layer absent handled by KnowledgeBuilder)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 6.1 Write property tests for Express Endpoint Analyzer
    - **Property 7: Route extraction and endpoint structure completeness** — generate Express source strings with random route definitions (varying methods, paths, middleware counts), verify each produces a complete `Endpoint` record
    - `// Feature: codebase-understanding-platform, Property 7`
    - _Requirements: 4.1–4.3_

- [ ] 7. React Component Analyzer
  - Implement `ReactComponentAnalyzer` in `backend/src/analyzers/react-component.analyzer.ts`
  - `detect()` returns true when JSX or TSX files exist
  - `analyze()` scans JSX/TSX files for exported functional components (arrow functions and `function` declarations) and class components extending `React.Component`
  - For each component: record `name`, `filePath`, `type`
  - Scan `import` statements to build parent-child relationships between components
  - Detect `fetch(url)` and `axios.*(url)` calls with string-literal URLs; record in `apiCalls`
  - Skip files with no recognizable component exports without recording errors
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 7.1 Write property tests for React Component Analyzer
    - **Property 8: Component detection and record completeness** — generate JSX/TSX source strings with random component names and types, verify records have all required fields
    - **Property 9: API call recording** — generate components with random fetch/axios URLs, verify URL appears in `apiCalls`
    - **Property 10: Parent-child relationship recording** — generate chains of component imports, verify bidirectional relationship entries
    - `// Feature: codebase-understanding-platform, Property 8, 9, 10`
    - _Requirements: 5.1–5.4_

- [ ] 8. Database Entity Analyzer
  - Implement `DatabaseEntityAnalyzer` in `backend/src/analyzers/database-entity.analyzer.ts`
  - `detect()` returns true when `mongoose` or `sequelize` appear in `packageJson.dependencies`
  - `analyze()` scans source files for:
    - Mongoose: `new Schema({...})` — extract schema variable name, field names, and types
    - Sequelize: `Model.define(...)` or class extending `Model` with `@Column` decorators — extract model name, columns, and types
  - Detect Mongoose `ref` fields and Sequelize `belongsTo`/`hasMany`/`hasOne` calls; record as `EntityRelationship`
  - If no models found, return empty `entities` array
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 8.1 Write property tests for Database Entity Analyzer
    - **Property 11: ORM entity extraction and record completeness** — generate Mongoose and Sequelize definition strings with random field sets, verify entity records have all required fields
    - **Property 12: Entity relationship recording** — generate entity definitions with random relationship declarations, verify each relationship appears in the output
    - `// Feature: codebase-understanding-platform, Property 11, 12`
    - _Requirements: 6.1–6.4_

- [ ] 9. Checkpoint — Ensure all analyzer unit and property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Knowledge Builder and Session Store
  - [ ] 10.1 Implement `KnowledgeBuilder` in `backend/src/engine/knowledge-builder.ts`
    - `assemble(partials, repo)`: merge all partial results into a single `KnowledgeBase`; set layer-absent flags when endpoint/component/entity lists are empty; set `metadata.hasPackageJson` from repo data
    - `persist(kb)`: store `kb` in an in-memory `Map<string, KnowledgeBase>` keyed by a UUID `sessionId`; set a 2-hour TTL timer to delete stale sessions
    - `get(sessionId)`: return the `KnowledgeBase` or `null`; return `null` for expired entries
    - Wrap `assemble` in try/catch; on fatal error, preserve partial KB and throw with error details
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 10.2 Write property tests for Knowledge Builder
    - **Property 13: KB assembly completeness** — generate random sets of partial results, verify assembled KB has all eight top-level keys with correct types
    - **Property 14: Session persistence round-trip** — generate KBs, persist, retrieve, deep-equal compare key fields
    - **Property 15: Session isolation** — generate two distinct KBs in separate sessions, verify neither session returns the other's data
    - `// Feature: codebase-understanding-platform, Property 13, 14, 15`
    - _Requirements: 7.1–7.4_

- [ ] 11. Express API server and upload endpoint
  - Create `backend/src/server.ts` with Express app, `cors`, and `multer` (memory storage, 200 MB limit)
  - `POST /api/upload`: accept multipart ZIP, run `RepositoryEngine.upload()` → `AnalysisEngine.run()` → `KnowledgeBuilder.assemble()` → `KnowledgeBuilder.persist()`; return `{ sessionId }` on success; return structured error on validation or analysis failure
  - `GET /api/session/:id`: return the full `KnowledgeBase` JSON for the session; 404 if not found
  - `GET /api/session/:id/modules`, `/endpoints`, `/components`, `/entities`: return the respective sub-arrays from the Knowledge Base
  - Add global error handler middleware returning `{ error: { code, message } }` JSON
  - _Requirements: 1.1–1.5, 7.3, 7.4_

- [ ] 12. Documentation Generator
  - [ ] 12.1 Implement `DocumentationGenerator` in `backend/src/docs/documentation-generator.ts`
    - `generateReadme(kb)`: produce Markdown with project name, description, technology stack badges, and module list
    - `generateArchitectureSummary(kb)`: produce Markdown listing all modules with their descriptions and dependency edges
    - `generateApiDocs(kb)`: produce Markdown table of all endpoints (method, path, middleware, service); emit "No endpoints detected" section when list is empty
    - `generateLearningGuide(kb)`: produce Markdown with all eight Learning_Journey stages as sections, populated with relevant KB content
    - All functions return a `string`; callers can stream as `text/markdown` with `Content-Disposition: attachment`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ] 12.2 Add documentation download routes
    - `GET /api/session/:id/docs/readme` → `generateReadme`
    - `GET /api/session/:id/docs/architecture` → `generateArchitectureSummary`
    - `GET /api/session/:id/docs/api` → `generateApiDocs`
    - `GET /api/session/:id/docs/learning-guide` → `generateLearningGuide`
    - Each route sets `Content-Type: text/markdown` and `Content-Disposition: attachment; filename=<type>.md`
    - _Requirements: 13.5_

  - [ ]* 12.3 Write property tests for Documentation Generator
    - **Property 18: Documentation generation completeness** — generate KBs with random combinations of data presence/absence, verify each generator function returns a non-empty string containing required section headers
    - `// Feature: codebase-understanding-platform, Property 18`
    - _Requirements: 13.1–13.5_

- [ ] 13. AI Assistant Service
  - [ ] 13.1 Implement `AIAssistantService` in `backend/src/ai/ai-assistant.service.ts`
    - Accept an `OpenAI` client instance (injected for testability)
    - `buildPrompt(kb, history, question)`: serialize relevant KB sections as JSON into the system prompt; append the last `Math.min(history.length, 10)` messages as chat history; append the new user question
    - `ask(sessionId, history, question)`: retrieve KB → build prompt → call `openai.chat.completions.create()` → parse response for entity name mentions and construct `EntityCitation[]` → return `AssistantResponse`
    - On LLM error, return a structured error message to the caller (do not throw)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 13.2 Add AI route to Express server
    - `POST /api/session/:id/ask`: accept `{ history: Message[], question: string }` body; call `AIAssistantService.ask()`; return `AssistantResponse`
    - _Requirements: 12.1_

  - [ ]* 13.3 Write property tests for AI Assistant Service
    - **Property 17: Conversation context window** — generate message arrays of length 1–15, verify `buildPrompt` includes exactly `min(length, 10)` messages in the prompt string
    - `// Feature: codebase-understanding-platform, Property 17`
    - _Requirements: 12.5_

- [ ] 14. Checkpoint — Ensure all backend tests pass, server starts, upload and session routes respond correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. React frontend — upload page and session context
  - Create `frontend/src/api/client.ts` with `uploadRepository(file)`, `getSession(id)`, `ask(id, history, question)`, `getDoc(id, type)` functions using `axios`
  - Create a `SessionContext` (React context) that holds the active `KnowledgeBase` and `sessionId`
  - Implement `UploadPage` with a drag-and-drop file input (accept `.zip` only), upload progress indicator, and error display
  - On successful upload, store `sessionId` in `localStorage` and navigate to `/session/:id/understand`
  - Implement `SessionLayout` that fetches the session on mount and renders the sidebar navigation + `<Outlet />`
  - _Requirements: 1.1, 7.4_

- [ ] 16. Understand View
  - Implement `UnderstandView` in `frontend/src/views/UnderstandView.tsx`
  - Display project name, version, description from `kb.metadata`
  - Render technology stack as badge chips using `kb.technologies`
  - Render module list with auto-generated descriptions from `kb.modules`
  - Render a force-directed dependency graph using `react-force-graph-2d` (nodes = modules, edges = dependency edges, circular edges styled in red)
  - Display warning panel listing `kb.warnings` if non-empty
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 17. Learning Journey View
  - Implement `LearningJourneyView` in `frontend/src/views/LearningJourneyView.tsx`
  - Hardcode the eight ordered stages: Project Overview → Architecture → Business Modules → Authentication → Core Features → API → Database → Ready for your first task
  - Track completed stages in component state (or `localStorage` for persistence within the session)
  - For each stage, map it to the corresponding KB section and render relevant data; display an informational message when the layer is absent
  - Display a progress bar showing `Math.round((completed / total) * 100)%`
  - Clicking a stage marks it as completed and advances the progress indicator
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 17.1 Write unit tests for Learning Journey progress calculation
    - **Property 16: Progress percentage accuracy** — generate integers 0 ≤ N ≤ 8, verify progress display matches formula
    - `// Feature: codebase-understanding-platform, Property 16`
    - _Requirements: 9.4_

- [ ] 18. Explorer View
  - Implement `ExplorerView` in `frontend/src/views/ExplorerView.tsx`
  - Left sidebar with collapsible sections: Frontend (Components), Backend (Endpoints), Database (Entities), Architecture (Modules)
  - Clicking a list item opens an `EntityDetail` panel on the right showing all fields from the data model
  - Component detail: name, file path, type, parent-child list (each child/parent is a link to that component), API calls list
  - Endpoint detail: method badge, path, source file, line number, middleware list, service function link
  - Entity detail: name, ORM type, fields table (name/type/required), relationships list
  - Module detail: name, root path, file count, description, dependency list
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 19. Feature Flow Tracer View
  - Implement `FeatureFlowView` in `frontend/src/views/FeatureFlowView.tsx`
  - `FlowSelector` dropdown populated from `kb.components` (filter to page/screen components) and `kb.endpoints`
  - On selection, construct a `FeatureFlow` by resolving the path: Component → API call URL match → Endpoint → Service → Entity; mark steps as unresolved if the link cannot be established
  - Render the flow as a vertical step diagram; each resolved step renders as a navigable link that opens the matching entity in the Explorer
  - Highlight the associated source file and line number in a code snippet panel when a step is clicked
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 20. AI Assistant View
  - Implement `AIAssistantView` in `frontend/src/views/AIAssistantView.tsx`
  - `ChatHistory` renders messages with role-based styling; citations rendered as hyperlinks navigating to the Explorer entity
  - `MessageInput` text area with submit on Enter (Shift+Enter for newline)
  - On submit: append user message to local history, call `client.ask(sessionId, history, question)`, append assistant response
  - Show loading spinner while awaiting response; show error banner on API failure
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 21. Documentation Download View
  - Implement `DocsView` in `frontend/src/views/DocsView.tsx`
  - Four download buttons: README, Architecture Summary, API Docs, Learning Guide
  - Each button calls `client.getDoc(sessionId, type)` and triggers a browser file download using a Blob URL
  - _Requirements: 13.1–13.5_

- [ ] 22. Wire everything together and final integration
  - [ ] 22.1 Add React Router routes in `frontend/src/App.tsx`
    - `/` → `UploadPage`
    - `/session/:id` → `SessionLayout` with nested routes for each view
    - Default redirect to `/session/:id/understand`
    - _Requirements: 7.4_

  - [ ] 22.2 Register all analyzers in `backend/src/server.ts`
    - Instantiate `TechDetectionAnalyzer`, `ModuleAnalyzer`, `ExpressEndpointAnalyzer`, `ReactComponentAnalyzer`, `DatabaseEntityAnalyzer`
    - Pass array to `AnalysisEngine` constructor
    - _Requirements: 14.1, 14.2_

  - [ ]* 22.3 Write backend integration tests
    - Upload a fixture ZIP containing a small Express + React + Mongoose sample project
    - Verify session is created, KB contains expected technologies, modules, endpoints, components, and entities
    - Verify all four documentation download routes return `text/markdown` with correct headers
    - _Requirements: 1.1, 7.3, 13.5_

- [ ] 23. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["4", "4.1", "5", "5.1", "6", "6.1", "7", "7.1", "8", "8.1"] },
    { "id": 3, "tasks": ["10.1", "10.2"] },
    { "id": 4, "tasks": ["11"] },
    { "id": 5, "tasks": ["12.1", "12.2", "12.3", "13.1", "13.2", "13.3"] },
    { "id": 6, "tasks": ["15", "16", "17", "17.1", "18", "19", "20", "21"] },
    { "id": 7, "tasks": ["22.1", "22.2", "22.3"] }
  ]
}
```

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests use `fast-check` with default 100-iteration runs
- Each property test file contains a comment `// Feature: codebase-understanding-platform, Property N: <title>` for traceability back to the design document
- In-memory session store is sufficient for the hackathon; upgrading to a persistent store (Redis, SQLite) only requires replacing the `KnowledgeBuilder` storage layer
- The LLM integration requires an `OPENAI_API_KEY` environment variable; the AI Assistant gracefully degrades if the key is absent
- The dependency graph visualization uses `react-force-graph-2d`; a fallback plain list is shown if the graph library fails to load
