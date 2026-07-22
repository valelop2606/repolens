import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AnalysisStatus } from '../../../shared/types';

export type ProjectDocument = HydratedDocument<Project>;

/**
 * Project schema — stores project metadata and tracks analysis status.
 * The original source code is NOT permanently stored here (see steering rules).
 */
@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, enum: ['pending', 'processing', 'completed', 'failed'] })
  status: AnalysisStatus;

  @Prop({ default: null })
  s3UploadKey: string | null;

  @Prop({ default: null })
  knowledgeBaseId: string | null;

  @Prop({ default: [] })
  technologies: string[];

  @Prop({ default: null })
  errorMessage: string | null;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
