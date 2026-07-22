import {
  Controller,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AnalysisService } from './analysis.service';

const MAX_ZIP_BYTES = 200 * 1024 * 1024;

/**
 * AnalysisController — HTTP entry point for the repository analysis pipeline.
 * Accepts a ZIP file upload and triggers full analysis for a given project.
 */
@Controller('projects/:projectId/analyze')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * POST /api/projects/:projectId/analyze
   * Multipart field name: "repository" (ZIP file)
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('repository', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ZIP_BYTES },
    }),
  )
  async analyze(
    @Param('projectId') projectId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_ZIP_BYTES })],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Repository ZIP file is required.');
    }
    const kb = await this.analysisService.analyzeRepository(projectId, file.buffer);
    return { sessionId: kb.sessionId, projectId: kb.projectId };
  }
}
