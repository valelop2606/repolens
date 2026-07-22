import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { SharedModule } from './shared/shared.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ChatModule } from './modules/chat/chat.module';
import { DocumentationModule } from './modules/documentation/documentation.module';

/**
 * Root application module.
 *
 * Architectural decision: modules are organised by business domain, not
 * by technical layer (controllers/, services/, etc.).  This keeps each
 * domain self-contained and independently testable.
 */
@Module({
  imports: [
    // Global config — reads .env automatically
    ConfigModule.forRoot({ isGlobal: true }),

    // MongoDB connection via Mongoose — URI comes from environment
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/codebase-understanding'),
      }),
    }),

    // Shared infrastructure (global: StorageService available everywhere)
    SharedModule,

    // Domain modules
    ProjectsModule,
    AnalysisModule,
    KnowledgeModule,
    ChatModule,
    DocumentationModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
