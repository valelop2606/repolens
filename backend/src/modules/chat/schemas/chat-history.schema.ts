import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChatHistoryDocument = HydratedDocument<ChatHistory>;

@Schema({ timestamps: true })
export class ChatHistory {
  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true })
  projectId: string;

  @Prop({
    type: [
      {
        role: { type: String, enum: ['user', 'assistant'] },
        content: String,
        timestamp: Date,
      },
    ],
    default: [],
  })
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
}

export const ChatHistorySchema = SchemaFactory.createForClass(ChatHistory);
ChatHistorySchema.index({ sessionId: 1 });
