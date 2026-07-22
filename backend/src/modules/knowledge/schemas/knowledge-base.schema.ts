import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type KnowledgeBaseDocument = HydratedDocument<KnowledgeBaseRecord>;

/**
 * KnowledgeBaseRecord stores the assembled Knowledge Base in MongoDB.
 * The KB is the Single Source of Truth — all features read from here.
 */
@Schema({ timestamps: true })
export class KnowledgeBaseRecord {
  @Prop({ required: true, unique: true })
  sessionId!: string;

  @Prop({ required: true })
  projectId!: string;

  @Prop({ type: Object, required: true })
  metadata!: Record<string, unknown>;

  @Prop({ type: Array, default: [] })
  technologies!: unknown[];

  @Prop({ type: Array, default: [] })
  modules!: unknown[];

  @Prop({ type: Array, default: [] })
  endpoints!: unknown[];

  @Prop({ type: Array, default: [] })
  components!: unknown[];

  @Prop({ type: Array, default: [] })
  entities!: unknown[];

  @Prop({ type: Object, default: { nodes: [], edges: [] } })
  dependencyGraph!: Record<string, unknown>;

  @Prop({ type: Array, default: [] })
  featureFlows!: unknown[];

  @Prop({ type: Array, default: [] })
  warnings!: unknown[];

  @Prop({ default: false })
  isComplete!: boolean;

  @Prop({ required: true })
  createdAt!: Date;
}

export const KnowledgeBaseSchema = SchemaFactory.createForClass(KnowledgeBaseRecord);

// Index for fast session lookups
KnowledgeBaseSchema.index({ sessionId: 1 });
KnowledgeBaseSchema.index({ projectId: 1 });
