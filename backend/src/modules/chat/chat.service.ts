import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ChatHistory, ChatHistoryDocument } from './schemas/chat-history.schema';
import {
  AssistantResponse,
  EntityCitation,
  KnowledgeBase,
  Message,
} from '../../shared/types';
import { LLM_CLIENT, LlmClient } from './llm.client';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly knowledgeService: KnowledgeService,
    @Inject(LLM_CLIENT)
    private readonly llm: LlmClient,
    @InjectModel(ChatHistory.name)
    private readonly chatHistoryModel: Model<ChatHistoryDocument>,
  ) {}

  /**
   * Builds the system prompt and chat turns sent to the LLM.
   * Public for testability (property tests).
   */
  public buildPrompt(
    kb: KnowledgeBase,
    history: Message[],
    question: string,
  ): { system: string; messages: Array<{ role: string; content: string }> } {
    const kbContext = {
      technologies: kb.technologies,
      modules: kb.modules,
      endpoints: kb.endpoints,
      components: kb.components,
      entities: kb.entities,
    };

    const system = [
      `You are an AI assistant that helps developers understand a codebase.`,
      `You have access to the following Knowledge Base about the project "${kb.metadata?.name ?? 'Unknown'}":`,
      '',
      JSON.stringify(kbContext, null, 2),
      '',
      'Use this information to answer questions accurately.',
      'When referencing specific modules, endpoints, components, or entities, mention them by name.',
    ].join('\n');

    // Take the last min(history.length, 10) messages as conversation context
    const windowSize = Math.min(history.length, 10);
    const recentHistory = history.slice(-windowSize);

    // Build messages array: history + new user question
    const messages: Array<{ role: string; content: string }> = recentHistory.map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      }),
    );

    // Append the new user question
    messages.push({ role: 'user', content: question });

    return { system, messages };
  }

  /**
   * Ask the AI assistant a question about the codebase.
   * Retrieves KB, builds prompt, calls the LLM, extracts citations.
   * On error: returns a structured error message (does not throw).
   */
  async ask(
    sessionId: string,
    history: Message[],
    question: string,
  ): Promise<AssistantResponse> {
    try {
      const kb = await this.knowledgeService.findBySession(sessionId);
      const { system, messages } = this.buildPrompt(kb, history, question);

      const responseText = await this.llm.complete(system, messages);

      // Extract entity citations by scanning response text for known entity names
      const citations = this.extractCitations(kb, responseText);

      return {
        content: responseText,
        citations,
      };
    } catch (error) {
      this.logger.error(
        `LLM call failed for session ${sessionId}`,
        error instanceof Error ? error.stack : String(error),
      );

      return {
        content:
          'I apologize, but I am unable to process your question at this time. Please try again later.',
        citations: [],
      };
    }
  }

  /**
   * Persist conversation history to MongoDB.
   */
  async saveHistory(
    sessionId: string,
    projectId: string,
    messages: Message[],
  ): Promise<void> {
    await this.chatHistoryModel.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        projectId,
        messages,
      },
      { upsert: true, new: true },
    );
  }

  /**
   * Extract entity citations from the AI response text.
   * Scans for known entity names from modules, endpoints, components, and entities.
   */
  private extractCitations(
    kb: KnowledgeBase,
    responseText: string,
  ): EntityCitation[] {
    const citations: EntityCitation[] = [];
    const seen = new Set<string>();

    // Check modules
    for (const mod of kb.modules) {
      if (mod.name && responseText.includes(mod.name) && !seen.has(mod.id)) {
        seen.add(mod.id);
        citations.push({
          entityId: mod.id,
          entityType: 'module',
          label: mod.name,
        });
      }
    }

    // Check endpoints
    for (const endpoint of kb.endpoints) {
      const endpointLabel = `${endpoint.method} ${endpoint.path}`;
      if (
        endpoint.path &&
        responseText.includes(endpoint.path) &&
        !seen.has(endpoint.id)
      ) {
        seen.add(endpoint.id);
        citations.push({
          entityId: endpoint.id,
          entityType: 'endpoint',
          label: endpointLabel,
        });
      }
    }

    // Check components
    for (const component of kb.components) {
      if (
        component.name &&
        responseText.includes(component.name) &&
        !seen.has(component.id)
      ) {
        seen.add(component.id);
        citations.push({
          entityId: component.id,
          entityType: 'component',
          label: component.name,
        });
      }
    }

    // Check entities
    for (const entity of kb.entities) {
      if (
        entity.name &&
        responseText.includes(entity.name) &&
        !seen.has(entity.id)
      ) {
        seen.add(entity.id);
        citations.push({
          entityId: entity.id,
          entityType: 'entity',
          label: entity.name,
        });
      }
    }

    return citations;
  }
}
