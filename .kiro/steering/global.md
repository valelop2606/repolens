---
inclusion: always
---

# Codebase Understanding Platform - Global Engineering Rules

## Project Overview

This project is an AI-powered developer onboarding platform designed to help developers understand existing software projects.

The platform analyzes repositories and generates an interactive Knowledge Base that explains:

- Project architecture
- Technologies
- Modules
- Frontend components
- Backend services
- API endpoints
- Database structures
- Feature execution flows

The goal is to reduce the time developers spend understanding unfamiliar codebases.

The platform does not replace documentation or developers.

It transforms existing code into an interactive learning experience.

---

# Core Philosophy

Developers should spend less time trying to understand a codebase and more time building features.

The system must follow these principles:

- Analyze repositories once.
- Generate structured knowledge.
- Reuse the generated Knowledge Base everywhere.
- Use AI as an assistant, not as the analysis engine.
- Prioritize maintainability over quick solutions.

The Knowledge Base is the Single Source of Truth.

---

# Technology Stack

## Frontend

The frontend application uses:

- React
- TypeScript
- Vite
- React Router
- Axios
- React Flow for interactive diagrams and architecture visualization

Frontend responsibilities:

- User interface
- Repository upload flow
- Dashboard visualization
- Learning Journey experience
- Feature exploration
- AI assistant interface

---

## Backend

The backend application uses:

- NestJS
- TypeScript

Backend responsibilities:

- Repository processing
- Analysis pipeline
- Knowledge generation
- API management
- Business logic
- AI integration
- Database communication

---

## Database

The application uses:

- MongoDB

MongoDB stores:

- Projects
- Analysis results
- Knowledge Base information
- Repository metadata
- Chat history
- Generated documentation

The original source code uploaded by users should not be permanently stored unless explicitly required.

---

# AWS Architecture

The project uses AWS as the cloud provider.

AWS services should be integrated following clear responsibilities.

---

## Amazon S3

Amazon S3 is used for file storage.

Possible uses:

- Repository uploads
- Generated documentation
- Analysis reports
- Exported project information
- Temporary processing files

Storage logic must be isolated from business logic.

Do not directly call AWS SDK methods throughout the application.

Use service abstractions.

---

## AWS Bedrock

AWS Bedrock provides AI capabilities.

Used for:

- Contextual project explanations
- Developer questions
- Learning Journey generation
- Documentation assistance
- Codebase understanding conversations

Important rule:

The AI model must NOT analyze repositories directly.

The analysis engine creates structured knowledge first.

Bedrock receives the Knowledge Base as context and generates explanations based on that information.

---

## AWS Lambda

AWS Lambda can be used for asynchronous processing.

Possible uses:

- Large repository analysis
- Background processing jobs
- Independent analysis workers
- Scalable repository processing

The architecture should allow moving expensive tasks from the API server into Lambda functions in the future.

---

# Backend Architecture

The backend must follow a modular architecture.

Do not organize the project only by technical layers.

Organize by business domains.

Recommended structure:

src/

modules/

analysis/

knowledge/

projects/

chat/

documentation/

shared/

config/

---

# Module Responsibilities

## Analysis Module

Responsible for repository analysis.

Responsibilities:

- Receive repository files
- Extract repository information
- Detect technologies
- Analyze source code
- Generate relationships between project elements

---

## Knowledge Module

Responsible for the Knowledge Base.

Responsibilities:

- Store structured project information
- Provide knowledge access
- Maintain the single source of truth

---

## Projects Module

Responsible for project management.

Responsibilities:

- Create projects
- Manage uploaded repositories
- Store project metadata
- Track analysis status

---

## Chat Module

Responsible for AI interaction.

Responsibilities:

- Receive developer questions
- Retrieve relevant Knowledge Base information
- Communicate with AWS Bedrock
- Return contextual explanations

---

## Documentation Module

Responsible for generated documentation.

Responsibilities:

- Generate README files
- Generate architecture explanations
- Generate API documentation
- Create learning materials

---

# Repository Analysis Pipeline

Repository analysis must follow these stages.

## 1. Repository Loader

Responsibilities:

- Receive ZIP files
- Extract repository contents
- Generate file tree structure

---

## 2. Technology Detection

Detect technologies using project metadata.

Examples:

- package.json
- tsconfig.json
- configuration files
- dependencies

Detect:

- Frameworks
- Libraries
- Languages
- Tools

---

## 3. Analysis Engine

Analyze:

Frontend:

- Pages
- Components
- Routes
- State management
- API consumption

Backend:

- Controllers
- Routes
- Services
- Business logic

General:

- Dependencies
- Imports
- Project structure
- Architecture patterns

---

## 4. Relationship Builder

Create connections between project elements.

Examples:

Frontend:

Screen

↓

Component

↓

API Request

↓

Backend Endpoint


Backend:

Controller

↓

Service

↓

Database


---

## 5. Knowledge Builder

Generate the Knowledge Base.

All application features must consume this generated information.

The repository should not be analyzed repeatedly for every feature.

---

# Frontend Architecture

The frontend must follow Feature-Based Architecture.

Recommended structure:

src/

features/

upload/

dashboard/

explore/

journey/

chat/

documentation/

shared/

config/

---

Each feature should contain its own:

- Components
- Pages
- Hooks
- Services
- Types

Avoid creating only global folders such as:

- components
- pages
- services

without clear ownership.

---

# AI Rules

Artificial Intelligence is an assistant.

AI should:

- Explain repository knowledge.
- Answer questions about the project.
- Help developers learn the architecture.

AI should not:

- Replace repository analysis.
- Invent project information.
- Analyze raw repositories directly.

All AI responses should be grounded in the Knowledge Base.

---

# Engineering Principles

Always prioritize:

- Clean Architecture
- Modularity
- Scalability
- Maintainability
- Separation of concerns
- Strong typing
- Dependency Injection
- SOLID principles

Avoid:

- God classes
- Duplicate logic
- Hardcoded values
- Business logic inside controllers
- Tight coupling
- Unnecessary complexity

---

# Code Quality Rules

When generating code:

- Prefer readable solutions.
- Explain important architectural decisions.
- Create reusable services.
- Keep modules independent.
- Use interfaces when appropriate.
- Avoid premature optimization.

Do not generate code only because it works.

Generate code that can be maintained by a development team.

---

# Extensibility Rules

The architecture must support future analyzers.

Examples:

- React Analyzer
- Express Analyzer
- NestJS Analyzer
- Spring Boot Analyzer
- Django Analyzer
- Laravel Analyzer

Adding a new analyzer should not require rewriting existing modules.

---

# Development Workflow

Before implementing important features:

1. Explain the architectural decision.
2. Define responsibilities.
3. Define data flow.
4. Implement the solution.
5. Document important decisions.

---

# Documentation Rules

Important decisions must be documented.

Maintain documentation for:

- Architecture decisions
- Technology choices
- API design
- Database design
- Development workflow

Documentation is part of the product.

---

# General Rule

If an implementation conflicts with this document, prioritize this document.

The objective is to build a professional, scalable, and maintainable product architecture.