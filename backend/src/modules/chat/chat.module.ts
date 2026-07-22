import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ChatService, BEDROCK_CLIENT } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatHistory, ChatHistorySchema } from './schemas/chat-history.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ChatHistory.name, schema: ChatHistorySchema }]),
    KnowledgeModule,
    ConfigModule,
  ],
  controllers: [ChatController],
  providers: [
    {
      provide: BEDROCK_CLIENT,
      useFactory: (configService: ConfigService) => {
        return new BedrockRuntimeClient({
          region: configService.get<string>('AWS_REGION', 'us-east-1'),
          credentials: {
            accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID', ''),
            secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
          },
        });
      },
      inject: [ConfigService],
    },
    ChatService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
