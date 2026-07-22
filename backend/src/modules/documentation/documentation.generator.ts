import { Injectable } from '@nestjs/common';
import { KnowledgeBase } from '../../shared/types';

/**
 * DocumentationGenerator — produces Markdown documentation artifacts
 * from a KnowledgeBase. Each method is synchronous and returns a string.
 *
 * Responsibilities:
 * - Generate README files
 * - Generate architecture explanations
 * - Generate API documentation
 * - Create learning materials
 */
@Injectable()
export class DocumentationGenerator {
  /**
   * Produce a Markdown README with project name, description,
   * technology stack badges, and module list.
   */
  generateReadme(kb: KnowledgeBase): string {
    const lines: string[] = [];

    lines.push(`# ${kb.metadata.name}`);
    lines.push('');
    lines.push(kb.metadata.description || 'No description available.');
    lines.push('');

    // Technology Stack
    lines.push('## Technology Stack');
    lines.push('');
    if (kb.technologies.length > 0) {
      for (const tech of kb.technologies) {
        lines.push(`- **${tech.name}** (confidence: ${tech.confidence})`);
      }
    } else {
      lines.push('No technologies detected.');
    }
    lines.push('');

    // Modules
    lines.push('## Modules');
    lines.push('');
    if (kb.modules.length > 0) {
      for (const mod of kb.modules) {
        lines.push(`- **${mod.name}**: ${mod.description}`);
      }
    } else {
      lines.push('No modules detected.');
    }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Produce a Markdown architecture summary listing all modules
   * with their descriptions and dependency edges.
   */
  generateArchitectureSummary(kb: KnowledgeBase): string {
    const lines: string[] = [];

    lines.push('# Architecture Summary');
    lines.push('');

    // Modules
    lines.push('## Modules');
    lines.push('');
    if (kb.modules.length > 0) {
      for (const mod of kb.modules) {
        lines.push(`### ${mod.name}`);
        lines.push('');
        lines.push(`- **Root Path**: ${mod.rootPath}`);
        lines.push(`- **Description**: ${mod.description}`);
        lines.push(`- **Files**: ${mod.files.length} file(s)`);
        if (mod.dependencies.length > 0) {
          lines.push(`- **Dependencies**: ${mod.dependencies.join(', ')}`);
        }
        lines.push('');
      }
    } else {
      lines.push('No modules detected.');
      lines.push('');
    }

    // Dependency Graph
    lines.push('## Dependency Graph');
    lines.push('');
    if (kb.dependencyGraph.edges.length > 0) {
      lines.push('| From | To | Circular |');
      lines.push('|------|-----|----------|');
      for (const edge of kb.dependencyGraph.edges) {
        lines.push(`| ${edge.from} | ${edge.to} | ${edge.isCircular ? 'Yes' : 'No'} |`);
      }
    } else {
      lines.push('No dependency edges detected.');
    }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Produce a Markdown table of all endpoints (method, path, middleware, service).
   * Emit "No endpoints detected" section when the list is empty.
   */
  generateApiDocs(kb: KnowledgeBase): string {
    const lines: string[] = [];

    lines.push('# API Documentation');
    lines.push('');

    if (kb.endpoints.length === 0) {
      lines.push('No endpoints detected');
      lines.push('');
      return lines.join('\n');
    }

    lines.push('## Endpoints');
    lines.push('');
    lines.push('| Method | Path | Middleware | Service |');
    lines.push('|--------|------|------------|---------|');
    for (const ep of kb.endpoints) {
      const middleware = ep.middlewares.length > 0 ? ep.middlewares.join(', ') : '-';
      const service = ep.serviceFunction || '-';
      lines.push(`| ${ep.method} | ${ep.path} | ${middleware} | ${service} |`);
    }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Produce a Markdown learning guide with all eight Learning Journey stages
   * as sections populated from the KB.
   */
  generateLearningGuide(kb: KnowledgeBase): string {
    const lines: string[] = [];

    lines.push('# Learning Guide');
    lines.push('');

    // Stage 1: Project Overview
    lines.push('## Project Overview');
    lines.push('');
    lines.push(`**Project**: ${kb.metadata.name} v${kb.metadata.version}`);
    lines.push('');
    lines.push(kb.metadata.description || 'No description available.');
    lines.push('');

    // Stage 2: Architecture
    lines.push('## Architecture');
    lines.push('');
    if (kb.modules.length > 0) {
      lines.push(`This project contains ${kb.modules.length} module(s):`);
      lines.push('');
      for (const mod of kb.modules) {
        lines.push(`- ${mod.name}: ${mod.description}`);
      }
    } else {
      lines.push('No architectural modules detected.');
    }
    lines.push('');

    // Stage 3: Business Modules
    lines.push('## Business Modules');
    lines.push('');
    if (kb.modules.length > 0) {
      for (const mod of kb.modules) {
        lines.push(`### ${mod.name}`);
        lines.push('');
        lines.push(`${mod.description}`);
        lines.push(`Files: ${mod.files.length}`);
        lines.push('');
      }
    } else {
      lines.push('No business modules detected in this project.');
    }
    lines.push('');

    // Stage 4: Authentication
    lines.push('## Authentication');
    lines.push('');
    const authEndpoints = kb.endpoints.filter(
      (ep) =>
        ep.path.includes('auth') ||
        ep.middlewares.some((m) => m.toLowerCase().includes('auth')),
    );
    if (authEndpoints.length > 0) {
      lines.push('Detected authentication-related endpoints:');
      lines.push('');
      for (const ep of authEndpoints) {
        lines.push(`- ${ep.method} ${ep.path}`);
      }
    } else {
      lines.push('No authentication layer detected in this project.');
    }
    lines.push('');

    // Stage 5: Core Features
    lines.push('## Core Features');
    lines.push('');
    if (kb.featureFlows.length > 0) {
      for (const flow of kb.featureFlows) {
        lines.push(`- **${flow.name}**: ${flow.steps.length} step(s)`);
      }
    } else {
      lines.push('No feature flows detected. Explore individual modules and endpoints to understand core features.');
    }
    lines.push('');

    // Stage 6: API
    lines.push('## API');
    lines.push('');
    if (kb.endpoints.length > 0) {
      lines.push(`This project exposes ${kb.endpoints.length} endpoint(s):`);
      lines.push('');
      for (const ep of kb.endpoints) {
        lines.push(`- ${ep.method} ${ep.path}`);
      }
    } else {
      lines.push('No API endpoints detected in this project.');
    }
    lines.push('');

    // Stage 7: Database
    lines.push('## Database');
    lines.push('');
    if (kb.entities.length > 0) {
      lines.push(`This project uses ${kb.entities.length} database entity(ies):`);
      lines.push('');
      for (const entity of kb.entities) {
        lines.push(`- **${entity.name}** (${entity.ormType}): ${entity.fields.length} field(s)`);
      }
    } else {
      lines.push('No database entities detected in this project.');
    }
    lines.push('');

    // Stage 8: Ready for your first task
    lines.push('## Ready for your first task');
    lines.push('');
    lines.push('You have completed the learning journey! You should now have a solid understanding of:');
    lines.push('');
    lines.push('- The project structure and architecture');
    lines.push('- The technology stack');
    lines.push('- Key modules and their responsibilities');
    lines.push('- API endpoints and data flow');
    lines.push('- Database structure');
    lines.push('');
    lines.push('You are ready to start contributing to this project.');
    lines.push('');

    return lines.join('\n');
  }
}
