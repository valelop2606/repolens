import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KnowledgeBase } from '../../shared/types';
import { KnowledgeBaseRecord, KnowledgeBaseDocument } from './schemas/knowledge-base.schema';

/**
 * KnowledgeService is the gateway to the Knowledge Base.
 *
 * All reads and writes to the KB go through this service.
 * No other service should query the knowledge_base collection directly.
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectModel(KnowledgeBaseRecord.name)
    private readonly kbModel: Model<KnowledgeBaseDocument>,
  ) {}

  /** Persist a Knowledge Base and return it. */
  async save(kb: KnowledgeBase): Promise<KnowledgeBase> {
    await this.kbModel.create({ ...kb });
    this.logger.log(`Knowledge Base saved — session: ${kb.sessionId}`);
    return kb;
  }

  /** Retrieve a Knowledge Base by session ID. */
  async findBySession(sessionId: string): Promise<KnowledgeBase> {
    const record = await this.kbModel.findOne({ sessionId }).lean().exec();
    if (!record) {
      throw new NotFoundException(`Knowledge Base for session "${sessionId}" not found`);
    }
    return record as unknown as KnowledgeBase;
  }

  /** Retrieve a Knowledge Base by project ID. */
  async findByProject(projectId: string): Promise<KnowledgeBase> {
    const record = await this.kbModel.findOne({ projectId }).lean().exec();
    if (!record) {
      throw new NotFoundException(`Knowledge Base for project "${projectId}" not found`);
    }
    return record as unknown as KnowledgeBase;
  }

  /** Return specific sub-arrays from the KB. */
  async getModules(sessionId: string) {
    const kb = await this.findBySession(sessionId);
    return kb.modules;
  }

  async getEndpoints(sessionId: string) {
    const kb = await this.findBySession(sessionId);
    return kb.endpoints;
  }

  async getComponents(sessionId: string) {
    const kb = await this.findBySession(sessionId);
    return kb.components;
  }

  async getEntities(sessionId: string) {
    const kb = await this.findBySession(sessionId);
    return kb.entities;
  }
}
