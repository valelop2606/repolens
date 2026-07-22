import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { DocumentationGenerator } from './documentation.generator';
import { KnowledgeService } from '../knowledge/knowledge.service';

/**
 * DocumentationController exposes endpoints for downloading generated
 * Markdown documentation derived from the Knowledge Base.
 *
 * Each route retrieves the KB for the given session, generates the
 * appropriate document, and returns it as a downloadable Markdown file.
 */
@Controller('sessions/:id/docs')
export class DocumentationController {
  constructor(
    private readonly documentationGenerator: DocumentationGenerator,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  /** GET /api/sessions/:id/docs/readme */
  @Get('readme')
  async generateReadme(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const kb = await this.knowledgeService.findBySession(id);
    const markdown = this.documentationGenerator.generateReadme(kb);

    res.set('Content-Type', 'text/markdown');
    res.set('Content-Disposition', 'attachment; filename=readme.md');

    return markdown;
  }

  /** GET /api/sessions/:id/docs/architecture */
  @Get('architecture')
  async generateArchitectureSummary(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const kb = await this.knowledgeService.findBySession(id);
    const markdown = this.documentationGenerator.generateArchitectureSummary(kb);

    res.set('Content-Type', 'text/markdown');
    res.set('Content-Disposition', 'attachment; filename=architecture.md');

    return markdown;
  }

  /** GET /api/sessions/:id/docs/api */
  @Get('api')
  async generateApiDocs(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const kb = await this.knowledgeService.findBySession(id);
    const markdown = this.documentationGenerator.generateApiDocs(kb);

    res.set('Content-Type', 'text/markdown');
    res.set('Content-Disposition', 'attachment; filename=api.md');

    return markdown;
  }

  /** GET /api/sessions/:id/docs/learning-guide */
  @Get('learning-guide')
  async generateLearningGuide(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const kb = await this.knowledgeService.findBySession(id);
    const markdown = this.documentationGenerator.generateLearningGuide(kb);

    res.set('Content-Type', 'text/markdown');
    res.set('Content-Disposition', 'attachment; filename=learning-guide.md');

    return markdown;
  }
}
