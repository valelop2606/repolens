import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatService } from './chat.service';
import { ChatHistory, ChatHistoryDocument } from './schemas/chat-history.schema';
import { Message, AssistantResponse } from '../../shared/types';

interface AskBodyDto {
  history: Message[];
  question: string;
}

@Controller('sessions/:id/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    @InjectModel(ChatHistory.name)
    private readonly chatHistoryModel: Model<ChatHistoryDocument>,
  ) {}

  /**
   * POST /api/sessions/:id/chat/ask
   * Accept a question with conversation history and return an AI-generated response.
   */
  @Post('ask')
  async ask(
    @Param('id') sessionId: string,
    @Body() body: AskBodyDto,
  ): Promise<AssistantResponse> {
    return this.chatService.ask(sessionId, body.history, body.question);
  }

  /**
   * GET /api/sessions/:id/chat/history
   * Return saved chat history for the given session.
   */
  @Get('history')
  async getHistory(@Param('id') sessionId: string): Promise<ChatHistory | null> {
    return this.chatHistoryModel.findOne({ sessionId }).exec();
  }
}
