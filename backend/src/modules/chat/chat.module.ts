import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatHistory, ChatHistorySchema } from './schemas/chat-history.schema';
import { GeminiClient, LLM_CLIENT } from './llm.client';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ChatHistory.name, schema: ChatHistorySchema }]),
    KnowledgeModule,
    ConfigModule,
  ],
  controllers: [ChatController],
  providers: [
    {
      provide: LLM_CLIENT,
      useFactory: (config: ConfigService) =>
        new GeminiClient(
          config.get<string>('GEMINI_API_KEY', ''),
          config.get<string>('GEMINI_MODEL', 'gemini-flash-latest'),
        ),
      inject: [ConfigService],
    },
    ChatService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
