import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectDocument } from './schemas/project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { AnalysisStatus } from '../../shared/types';

/**
 * ProjectsService manages project lifecycle.
 * Business logic belongs here — the controller only handles HTTP concerns.
 */
@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
  ) {}

  async create(dto: CreateProjectDto): Promise<ProjectDocument> {
    const project = await this.projectModel.create({
      name: dto.name,
      description: dto.description ?? '',
      status: 'pending' satisfies AnalysisStatus,
      s3UploadKey: null,
      knowledgeBaseId: null,
      technologies: [],
      errorMessage: null,
    });
    this.logger.log(`Created project ${project.id}: "${project.name}"`);
    return project;
  }

  async findAll(): Promise<ProjectDocument[]> {
    return this.projectModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(id).exec();
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async updateStatus(
    id: string,
    status: AnalysisStatus,
    extras: Partial<Pick<Project, 's3UploadKey' | 'knowledgeBaseId' | 'technologies' | 'errorMessage'>> = {},
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findByIdAndUpdate(id, { status, ...extras }, { new: true })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async delete(id: string): Promise<void> {
    const result = await this.projectModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    this.logger.log(`Deleted project ${id}`);
  }
}
