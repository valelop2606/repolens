# RepoLens

**Understand any codebase in minutes, not days.**
Upload a repository and RepoLens builds an interactive knowledge base: architecture, modules, API endpoints, React components, database entities — plus an AI assistant that answers questions about the code and auto-generated documentation.

> Built in a hackathon (Código Facilito) and actively being improved.

## The problem

Onboarding onto an unfamiliar project is slow: no docs, outdated diagrams, and senior devs answering the same questions. RepoLens turns the code itself into an onboarding experience.

## Features

- **Static analysis pipeline** — pluggable analyzers detect technologies, modules, NestJS endpoints, React components and database entities.
- **Knowledge base** — analysis results stored per session and exposed through a REST API.
- **AI assistant** — chat grounded on the knowledge base (Claude via AWS Bedrock), with conversation history and entity citations.
- **Doc generator** — README, architecture overview, API reference and a learning guide generated from the analysis.
- **Interactive UI** — dependency graph explorer, feature-flow view and a guided learning journey with progress tracking.
- **Property-based testing** — core analyzers and the pipeline are tested with `fast-check`, not only example-based tests.

## Architecture

```
React (Vite) SPA ──► NestJS REST API ──► Analysis pipeline
                          │                 ├─ repository loader (ZIP → files)
                          │                 ├─ analyzers (tech, modules, endpoints, components, entities)
                          │                 └─ knowledge builder
                          ├─► MongoDB (projects, knowledge base, chat history)
                          ├─► AWS S3 (uploaded repositories)
                          └─► AWS Bedrock / Claude (AI assistant)
```

## Tech stack

| Layer | Tech |
|---|---|
| Backend | NestJS 10, TypeScript, Mongoose, class-validator |
| AI | AWS Bedrock (Claude) |
| Storage | MongoDB, AWS S3 |
| Frontend | React 18, Vite, React Router, react-force-graph |
| Testing | Jest, Vitest, fast-check (property-based), integration tests |

## API overview

All routes are prefixed with `/api`.

| Method | Route | Description |
|---|---|---|
| `POST` | `/projects` | Create a project |
| `GET` | `/projects` · `/projects/:id` | List / get projects |
| `DELETE` | `/projects/:id` | Delete a project |
| `POST` | `/projects/:projectId/analyze` | Upload a repo ZIP and run the analysis |
| `GET` | `/sessions/:id` | Full knowledge base |
| `GET` | `/sessions/:id/{modules,endpoints,components,entities}` | Knowledge base sections |
| `POST` | `/sessions/:id/chat/ask` | Ask the AI assistant |
| `GET` | `/sessions/:id/chat/history` | Chat history |
| `GET` | `/sessions/:id/docs/{readme,architecture,api,learning-guide}` | Generated docs |

## Getting started

Requirements: Node 20+, MongoDB, and AWS credentials with S3 + Bedrock access.

```bash
# backend
cd backend
cp .env.example .env   # fill in values
npm install
npm run start:dev      # http://localhost:3000/api

# frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

### Tests

```bash
cd backend && npm test
cd frontend && npm test
```

## Spec-driven development

The project was built from written specs (requirements → design → tasks) kept in [`.kiro/specs`](.kiro/specs/codebase-understanding-platform).

## Roadmap

- [ ] Analyze public GitHub repos by URL (no ZIP upload)
- [ ] Support more frameworks (Express, Django, Spring)
- [ ] Docker Compose for one-command local setup
- [ ] Live demo deployment
- [ ] Screenshots / demo GIF

## Author

Valeria López — [GitHub](https://github.com/valelop2606)
