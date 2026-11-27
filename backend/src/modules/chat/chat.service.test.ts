// Mock the knowledge service module to avoid schema compilation issues
jest.mock('../knowledge/knowledge.service');

import { ChatService } from './chat.service';
import { KnowledgeBase, Message } from '../../shared/types';

describe('ChatService', () => {
  let service: ChatService;
  let mockLlm: any;
  let mockKnowledgeService: any;
  let mockChatHistoryModel: any;
  let mockConfigService: any;

  const sampleKb: KnowledgeBase = {
    sessionId: 'session-1',
    projectId: 'project-1',
    createdAt: new Date(),
    metadata: {
      name: 'TestProject',
      version: '1.0.0',
      description: 'A test project',
      dependencies: {},
      hasPackageJson: true,
    },
    technologies: [{ name: 'TypeScript', confidence: 'high', detectedBy: 'package.json' }],
    modules: [
      { id: 'mod-1', name: 'AuthModule', rootPath: 'src/auth', files: [], description: 'Auth module', dependencies: [] },
    ],
    endpoints: [
      { id: 'ep-1', method: 'GET', path: '/api/users', sourceFile: 'users.controller.ts', lineNumber: 10, middlewares: [], serviceFunction: null, serviceFile: null },
    ],
    components: [
      { id: 'comp-1', name: 'LoginForm', filePath: 'src/LoginForm.tsx', type: 'functional', apiCalls: [], children: [], parents: [] },
    ],
    entities: [
      { id: 'ent-1', name: 'User', ormType: 'mongoose', fields: [{ name: 'email', type: 'string', required: true }], relationships: [], sourceFile: 'user.schema.ts' },
    ],
    dependencyGraph: { nodes: [], edges: [] },
    featureFlows: [],
    warnings: [],
    isComplete: true,
  };

  beforeEach(() => {
    mockLlm = {
      complete: jest.fn(),
    };
    mockKnowledgeService = {
      findBySession: jest.fn().mockResolvedValue(sampleKb),
    };
    mockChatHistoryModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn() }),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue('us-east-1'),
    };

    service = new ChatService(
      mockConfigService,
      mockKnowledgeService,
      mockLlm,
      mockChatHistoryModel,
    );
  });

  describe('buildPrompt', () => {
    it('should include KB context in system prompt', () => {
      const history: Message[] = [];
      const question = 'What does this project do?';

      const result = service.buildPrompt(sampleKb, history, question);

      expect(result.system).toContain('TestProject');
      expect(result.system).toContain('AuthModule');
      expect(result.system).toContain('/api/users');
      expect(result.system).toContain('LoginForm');
      expect(result.system).toContain('User');
    });

    it('should include only the last 10 messages from history', () => {
      const history: Message[] = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `message-${i}`,
        timestamp: new Date(),
      }));
      const question = 'New question';

      const result = service.buildPrompt(sampleKb, history, question);

      // 10 from history + 1 new question = 11 messages
      expect(result.messages).toHaveLength(11);
      // First message in the result should be message-5 (index 5, since we take last 10 of 15)
      expect(result.messages[0].content).toBe('message-5');
      // Last message should be the new question
      expect(result.messages[10].content).toBe('New question');
      expect(result.messages[10].role).toBe('user');
    });

    it('should handle empty history', () => {
      const result = service.buildPrompt(sampleKb, [], 'Hello');

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should handle history shorter than 10 messages', () => {
      const history: Message[] = [
        { role: 'user', content: 'First', timestamp: new Date() },
        { role: 'assistant', content: 'Response', timestamp: new Date() },
      ];

      const result = service.buildPrompt(sampleKb, history, 'Follow up');

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].content).toBe('First');
      expect(result.messages[1].content).toBe('Response');
      expect(result.messages[2].content).toBe('Follow up');
    });
  });

  describe('ask', () => {
    it('should return structured response with citations on success', async () => {
      mockLlm.complete.mockResolvedValue(
        'The AuthModule handles authentication. The LoginForm component uses /api/users endpoint.',
      );

      const result = await service.ask('session-1', [], 'Tell me about auth');

      expect(result.content).toContain('AuthModule');
      expect(result.citations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ entityId: 'mod-1', entityType: 'module', label: 'AuthModule' }),
          expect.objectContaining({ entityId: 'comp-1', entityType: 'component', label: 'LoginForm' }),
          expect.objectContaining({ entityId: 'ep-1', entityType: 'endpoint', label: 'GET /api/users' }),
        ]),
      );
    });

    it('should return structured error on LLM failure (not throw)', async () => {
      mockLlm.complete.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.ask('session-1', [], 'Question');

      expect(result.content).toContain('unable to process');
      expect(result.citations).toEqual([]);
    });

    it('should return structured error when KB not found', async () => {
      mockKnowledgeService.findBySession.mockRejectedValue(
        new Error('Not found'),
      );

      const result = await service.ask('invalid-session', [], 'Question');

      expect(result.content).toContain('unable to process');
      expect(result.citations).toEqual([]);
    });
  });

  describe('saveHistory', () => {
    it('should upsert chat history', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello', timestamp: new Date() },
      ];

      await service.saveHistory('session-1', 'project-1', messages);

      expect(mockChatHistoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { sessionId: 'session-1' },
        { sessionId: 'session-1', projectId: 'project-1', messages },
        { upsert: true, new: true },
      );
    });
  });
});
