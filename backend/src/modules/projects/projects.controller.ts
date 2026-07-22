import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';

const MAX_ZIP_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * ProjectsController handles HTTP routing only.
 * All business logic is delegated to ProjectsService.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * POST /api/projects
   * Create a project record before uploading the repository ZIP.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  /**
   * GET /api/projects
   * List all projects ordered by creation date.
   */
  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  /**
   * GET /api/projects/:id
   * Retrieve a single project by MongoDB ObjectId.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  /**
   * DELETE /api/projects/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.projectsService.delete(id);
  }
}
