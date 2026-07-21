# Requirements Document

## Introduction

The Codebase Understanding Platform is a web application that automatically analyzes a JavaScript/TypeScript software repository and generates an interactive knowledge base to help developers understand any codebase before writing their first line of code. The platform reads the repository structure, extracts architectural information, and exposes that knowledge through multiple specialized views: a high-level overview, a guided learning journey, an explorer for navigating modules and endpoints, a feature flow tracer, a contextual AI assistant, and an automatic documentation generator.

The MVP targets the JavaScript and TypeScript ecosystem (React, Node.js, Express, TypeScript) and is architecturally modular to support additional languages and frameworks in future versions.

---

## Glossary

- **Repository**: A directory tree of source code files uploaded by the user for analysis.
- **Repository_Engine**: The subsystem responsible for reading and traversing the uploaded repository file tree.
- **Analysis_Engine**: The subsystem responsible for parsing files, detecting technologies, and extracting structural information from the repository.
- **Knowledge_Builder**: The subsystem that assembles raw analysis results into a structured Knowledge Base.
- **Knowledge_Base**: The central data store containing all extracted project knowledge (metadata, technologies, modules, endpoints, components, entities, dependencies, feature flows).
- **Understand_View**: The UI module that displays the high-level project overview.
- **Learning_Journey**: The UI module that displays the guided onboarding roadmap.
- **Explorer**: The UI module that allows navigation of frontend components, backend endpoints, database entities, and architectural modules.
- **Feature_Flow_Tracer**: The UI module that visualizes the full execution path of a feature from user interaction to database and back.
- **AI_Assistant**: The UI module that answers natural-language questions using exclusively the Knowledge Base.
- **Documentation_Generator**: The subsystem that produces structured documentation artifacts from the Knowledge Base.
- **Analyzer**: An independent, pluggable module within the Analysis_Engine that handles a specific framework or language (e.g., React analyzer, Express analyzer).
- **Feature_Flow**: A directed graph representing the full path of a single user-facing feature through the application layers.
- **Module**: A cohesive grouping of related files and responsibilities within the repository.
- **Endpoint**: An HTTP route defined in the backend (e.g., `POST /api/payments`).
- **Component**: A React UI component identified in the frontend source.
- **Entity**: A database collection, model, or table identified in the source code.

---

## Requirements

### Requirement 1: Repository Upload and Ingestion

**User Story:** As a developer, I want to upload a repository so that the platform can analyze it and build the knowledge base.

#### Acceptance Criteria

1. WHEN a user uploads a ZIP archive containing a JavaScript or TypeScript repository, THE Repository_Engine SHALL extract and traverse the complete file tree.
2. WHEN the uploaded archive exceeds 200 MB, THE Repository_Engine SHALL reject the upload and return a descriptive error message indicating the size limit.
3. WHEN the uploaded file is not a ZIP archive, THE Repository_Engine SHALL reject the upload and return a descriptive error message indicating the expected format.
4. WHEN the repository root contains a `package.json` file, THE Repository_Engine SHALL read it to extract project name, version, description, and declared dependencies.
5. IF the repository contains no `package.json` file, THEN THE Repository_Engine SHALL continue analysis and flag the Knowledge Base metadata as incomplete.

---

### Requirement 2: Technology Detection

**User Story:** As a developer, I want the platform to detect which technologies are used in the repository so that I can understand the technology stack at a glance.

#### Acceptance Criteria

1. WHEN the Analysis_Engine processes a repository, THE Analysis_Engine SHALL identify the presence of React, Node.js, Express, and TypeScript based on `package.json` dependencies and source file extensions.
2. WHEN TypeScript configuration files (`.tsconfig.json`) are present, THE Analysis_Engine SHALL record TypeScript as a detected technology in the Knowledge Base.
3. WHEN JSX or TSX files are present, THE Analysis_Engine SHALL record React as a detected technology in the Knowledge Base.
4. WHEN Express is listed as a dependency in `package.json`, THE Analysis_Engine SHALL record Express as a detected technology in the Knowledge Base.
5. THE Analysis_Engine SHALL store the detected technology list in the Knowledge Base as a structured array with technology name and confidence level.

---

### Requirement 3: Architecture and Module Extraction

**User Story:** As a developer, I want the platform to identify the architectural structure and modules of the project so that I can understand how the codebase is organized.

#### Acceptance Criteria

1. WHEN the Analysis_Engine processes the repository file tree, THE Analysis_Engine SHALL identify top-level modules by grouping related directories and files under a common responsibility.
2. WHEN a directory contains an `index.js` or `index.ts` entry point, THE Analysis_Engine SHALL treat it as a module boundary and record it in the Knowledge Base.
3. THE Knowledge_Builder SHALL associate each module with a name, a root path, a list of contained files, and a brief auto-generated description.
4. WHEN circular dependencies are detected between modules, THE Analysis_Engine SHALL record them as dependency warnings in the Knowledge Base.
5. THE Analysis_Engine SHALL extract inter-module import relationships and store them as a directed dependency graph in the Knowledge Base.

---

### Requirement 4: Endpoint Extraction

**User Story:** As a developer, I want the platform to extract all API endpoints from the backend so that I can understand the available API surface.

#### Acceptance Criteria

1. WHEN the Analysis_Engine detects Express route definitions in source files, THE Analysis_Engine SHALL extract each route's HTTP method, path pattern, and source file location.
2. WHEN route middleware chains are identified, THE Analysis_Engine SHALL record the middleware names associated with each endpoint in the Knowledge Base.
3. THE Knowledge_Builder SHALL store each endpoint with HTTP method, path, source file, line number, and associated middleware list.
4. WHEN an endpoint handler references a service function, THE Analysis_Engine SHALL record the service function name and file in the endpoint's Knowledge Base entry.
5. IF no Express routes are detected in the repository, THEN THE Knowledge_Builder SHALL store an empty endpoint list and mark the backend layer as absent.

---

### Requirement 5: Frontend Component Extraction

**User Story:** As a developer, I want the platform to identify all React components so that I can understand the frontend structure.

#### Acceptance Criteria

1. WHEN the Analysis_Engine scans JSX or TSX files, THE Analysis_Engine SHALL identify React functional components and class components by their export signatures.
2. WHEN a component file imports an API client or makes a `fetch`/`axios` call, THE Analysis_Engine SHALL record the associated endpoint URL patterns in the component's Knowledge Base entry.
3. THE Knowledge_Builder SHALL store each component with name, file path, component type (functional/class), and list of API calls.
4. WHEN a component imports another component, THE Analysis_Engine SHALL record the parent-child relationship in the Knowledge Base.
5. IF a JSX or TSX file exports no recognizable component, THEN THE Analysis_Engine SHALL skip it without recording an error.

---

### Requirement 6: Database Entity Extraction

**User Story:** As a developer, I want the platform to identify database models and entities so that I can understand the data layer.

#### Acceptance Criteria

1. WHEN the Analysis_Engine detects Mongoose schema definitions, THE Analysis_Engine SHALL extract the schema name, field names, and field types and store them in the Knowledge Base.
2. WHEN the Analysis_Engine detects Sequelize model definitions, THE Analysis_Engine SHALL extract the model name, column names, and column types and store them in the Knowledge Base.
3. THE Knowledge_Builder SHALL store each entity with name, ORM type, field list, and source file path.
4. WHEN relationships between entities are defined (e.g., `ref` in Mongoose, `belongsTo` in Sequelize), THE Analysis_Engine SHALL record those relationships in the Knowledge Base.
5. IF no database model definitions are detected, THEN THE Knowledge_Builder SHALL store an empty entity list and mark the database layer as absent.

---

### Requirement 7: Knowledge Base Construction

**User Story:** As a developer, I want all extracted information to be consolidated into a single, consistent knowledge base so that every feature in the platform operates from the same source of truth.

#### Acceptance Criteria

1. WHEN the Analysis_Engine completes processing all analyzers, THE Knowledge_Builder SHALL assemble all partial results into a single Knowledge Base document.
2. THE Knowledge_Base SHALL contain: project metadata, detected technologies, module list, endpoint list, component list, entity list, dependency graph, and analysis warnings.
3. WHEN the Knowledge_Builder finishes assembly, THE Knowledge_Base SHALL be persisted to durable storage and assigned a unique session identifier.
4. WHEN a user requests any platform view, THE system SHALL serve data exclusively from the Knowledge_Base associated with the active session.
5. IF the Knowledge_Builder encounters a fatal error during assembly, THEN THE system SHALL preserve any partial results and return a descriptive error to the user.

---

### Requirement 8: Understand View

**User Story:** As a developer, I want to see a high-level overview of the project so that I can quickly grasp what the project does, how it is structured, and which technologies it uses.

#### Acceptance Criteria

1. WHEN a user opens the Understand_View, THE Understand_View SHALL display the project name, description, and detected technology stack sourced from the Knowledge_Base.
2. WHEN a user opens the Understand_View, THE Understand_View SHALL display the list of top-level modules with their auto-generated descriptions.
3. WHEN a user opens the Understand_View, THE Understand_View SHALL display a visual dependency graph of modules.
4. THE Understand_View SHALL display important directories identified during analysis.
5. WHEN the Knowledge_Base contains analysis warnings, THE Understand_View SHALL display a summary of those warnings to the user.

---

### Requirement 9: Learning Journey

**User Story:** As a developer, I want a guided onboarding roadmap so that I can learn the project in a structured and progressive manner.

#### Acceptance Criteria

1. WHEN a user opens the Learning_Journey, THE Learning_Journey SHALL display an ordered roadmap with the following stages in sequence: Project Overview → Architecture → Business Modules → Authentication → Core Features → API → Database → Ready for your first task.
2. WHEN a user selects a Learning_Journey stage, THE Learning_Journey SHALL display the relevant Knowledge_Base content for that stage.
3. WHEN a user completes a stage, THE Learning_Journey SHALL mark it as completed and advance the progress indicator.
4. WHILE a user is on the Learning_Journey, THE Learning_Journey SHALL display the user's current progress as a percentage of completed stages.
5. WHEN a stage has no corresponding data in the Knowledge_Base (e.g., no database layer detected), THE Learning_Journey SHALL display an informational message explaining that the layer is absent in this project.

---

### Requirement 10: Explorer

**User Story:** As a developer, I want to explore every part of the application by category so that I can locate any component, endpoint, or entity quickly.

#### Acceptance Criteria

1. WHEN a user opens the Explorer, THE Explorer SHALL display navigation sections for: Frontend (Screens, Components), Backend (Endpoints, Controllers, Services), Database (Entities), and Architecture (Modules, Dependencies).
2. WHEN a user selects a component in the Explorer, THE Explorer SHALL display the component's name, file path, component type, parent-child relationships, and list of API calls.
3. WHEN a user selects an endpoint in the Explorer, THE Explorer SHALL display the endpoint's HTTP method, path, source file, line number, middleware list, and linked service function.
4. WHEN a user selects an entity in the Explorer, THE Explorer SHALL display the entity's name, ORM type, field list, and relationships to other entities.
5. WHEN a user selects a module in the Explorer, THE Explorer SHALL display the module's name, root path, contained files, description, and dependency list.

---

### Requirement 11: Feature Flow Tracer

**User Story:** As a developer, I want to trace the complete execution path of any feature from the UI to the database so that I understand how the layers connect.

#### Acceptance Criteria

1. WHEN a user selects a feature to trace, THE Feature_Flow_Tracer SHALL resolve and display the complete execution path: React Screen → Component → API Request → Express Route → Controller → Service → Database → Response → Frontend Update.
2. WHEN a step in the feature flow references a known Knowledge_Base entity (component, endpoint, entity), THE Feature_Flow_Tracer SHALL render it as a navigable link to the Explorer.
3. WHEN the Feature_Flow_Tracer cannot resolve a complete path (missing layer), THE Feature_Flow_Tracer SHALL display the resolved portion and mark unresolved steps as unknown.
4. THE Feature_Flow_Tracer SHALL allow users to select a starting point from a list of known components or endpoints.
5. WHEN a user selects a Feature_Flow step, THE Feature_Flow_Tracer SHALL highlight the associated source file and line number.

---

### Requirement 12: AI Assistant

**User Story:** As a developer, I want to ask natural-language questions about the codebase so that I can get contextual answers without reading every file.

#### Acceptance Criteria

1. WHEN a user submits a question to the AI_Assistant, THE AI_Assistant SHALL generate a response using exclusively the content of the active session's Knowledge_Base.
2. WHEN the Knowledge_Base does not contain sufficient information to answer a question, THE AI_Assistant SHALL respond with a message stating that the information is not available in the analyzed repository.
3. THE AI_Assistant SHALL cite the specific Knowledge_Base entities (modules, endpoints, components, entities) referenced in each response.
4. WHEN a user asks a question that references a known entity name, THE AI_Assistant SHALL include a navigable link to that entity in the Explorer within the response.
5. THE AI_Assistant SHALL maintain conversation context across at least 10 consecutive messages within a single session.

---

### Requirement 13: Documentation Generator

**User Story:** As a developer, I want the platform to automatically generate project documentation so that I can share it with the team or use it as a starting point for official docs.

#### Acceptance Criteria

1. WHEN a user requests documentation generation, THE Documentation_Generator SHALL produce a README containing project name, description, technology stack, and module list.
2. WHEN a user requests documentation generation, THE Documentation_Generator SHALL produce an architecture summary describing identified modules and their dependencies.
3. WHEN endpoints are present in the Knowledge_Base, THE Documentation_Generator SHALL produce API documentation listing each endpoint's HTTP method, path, middleware, and linked service.
4. WHEN a user requests documentation generation, THE Documentation_Generator SHALL produce a learning guide following the same stage order as the Learning_Journey.
5. THE Documentation_Generator SHALL make each generated document available for download as a Markdown file.

---

### Requirement 14: Extensibility — Analyzer Plugin Model

**User Story:** As a platform maintainer, I want the analysis architecture to be modular so that new language and framework analyzers can be added without modifying existing analyzers.

#### Acceptance Criteria

1. THE Analysis_Engine SHALL load analyzers through a well-defined interface that each Analyzer implements.
2. WHEN a new Analyzer is registered, THE Analysis_Engine SHALL invoke it during the analysis pipeline without requiring changes to the core engine.
3. THE Analyzer interface SHALL define at minimum: a `detect(repository)` method that returns a boolean, and an `analyze(repository)` method that returns a structured partial result.
4. WHEN an Analyzer's `detect` method returns false, THE Analysis_Engine SHALL skip that Analyzer without recording an error.
5. IF an Analyzer throws an unhandled exception during execution, THEN THE Analysis_Engine SHALL catch the exception, record a warning in the Knowledge_Base, and continue processing remaining analyzers.
