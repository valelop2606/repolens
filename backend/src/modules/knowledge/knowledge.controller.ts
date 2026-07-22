import { Controller, Get, Param } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

/**
 * KnowledgeController exposes read-only access to the Knowledge Base.
 * The KB is written only by the Analysis pipeline.
 */
@Controller('sessions')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  /** GET /api/sessions/:id — full Knowledge Base */
  @Get(':id')
  getSession(@Param('id') id: string) {
    return this.knowledgeService.findBySession(id);
  }

  /** GET /api/sessions/:id/modules */
  @Get(':id/modules')
  getModules(@Param('id') id: string) {
    return this.knowledgeService.getModules(id);
  }

  /** GET /api/sessions/:id/endpoints */
  @Get(':id/endpoints')
  getEndpoints(@Param('id') id: string) {
    return this.knowledgeService.getEndpoints(id);
  }

  /** GET /api/sessions/:id/components */
  @Get(':id/components')
  getComponents(@Param('id') id: string) {
    return this.knowledgeService.getComponents(id);
  }

  /** GET /api/sessions/:id/entities */
  @Get(':id/entities')
  getEntities(@Param('id') id: string) {
    return this.knowledgeService.getEntities(id);
  }
}
