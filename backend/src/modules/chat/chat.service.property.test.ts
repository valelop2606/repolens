// Feature: codebase-understanding-platform, Property 17: Conversation context window
import * as fc from 'fast-check';
import { ChatService } from './chat.service';
import { KnowledgeBase, Message } from '../../shared/types';

describe('ChatService — Property Tests', () => {
  // Instantiate ChatService with mocked dependencies since buildPrompt is a pure function
  const chatService = new ChatService(
    {} as any, // ConfigService — not used by buildPrompt
    {} as any, // KnowledgeService — not used by buildPrompt
    {} as any, // BedrockRuntimeClient — not used by buildPrompt
    {} as any, // Mongoose Model<ChatHistoryDocument> — not used by buildPrompt
  );

  // --- Arbitraries ---

  const arbMessage: fc.Arbitrary<Message> = fc.record({
    role: fc.constantFrom('user' as const, 'assistant' as const),
    content: fc.string({ minLength: 1, maxLength: 200 }),
    timestamp: fc.date(),
  });

  // Minimal valid KnowledgeBase for testing buildPrompt
  const minimalKb: KnowledgeBase = {
    sessionId: 'test-session-id',
    projectId: 'test-project-id',
    createdAt: new Date(),
    metadata: {
      name: 'Test Project',
      version: '1.0.0',
      description: 'A test project',
      dependencies: {},
      hasPackageJson: true,
    },
    technologies: [{ name: 'TypeScript', confidence: 'high', detectedBy: 'package.json' }],
    modules: [],
    endpoints: [],
    components: [],
    entities: [],
    dependencyGraph: { nodes: [], edges: [] },
    featureFlows: [],
    warnings: [],
    isComplete: true,
  };

  // --- Property 17: Conversation context window ---
  // **Validates: Requirements 12.5**
  describe('Property 17: Conversation context window', () => {
    it('buildPrompt includes exactly min(history.length, 10) history messages plus the user question', () => {
      fc.assert(
        fc.property(
          fc.array(arbMessage, { minLength: 1, maxLength: 15 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (history, question) => {
            const result = chatService.buildPrompt(minimalKb, history, question);

            const expectedHistoryCount = Math.min(history.length, 10);
            // messages array = history messages + 1 new user question
            const expectedTotalMessages = expectedHistoryCount + 1;

            expect(result.messages).toHaveLength(expectedTotalMessages);

            // The last message should always be the new user question
            const lastMessage = result.messages[result.messages.length - 1];
            expect(lastMessage.role).toBe('user');
            expect(lastMessage.content).toBe(question);

            // History messages should be the last N from the input history
            const expectedHistory = history.slice(-expectedHistoryCount);
            for (let i = 0; i < expectedHistoryCount; i++) {
              expect(result.messages[i].role).toBe(expectedHistory[i].role);
              expect(result.messages[i].content).toBe(expectedHistory[i].content);
            }
          },
        ),
        { numRuns: 200 },
      );
    });

    it('buildPrompt system prompt contains serialized KB sections', () => {
      fc.assert(
        fc.property(
          fc.array(arbMessage, { minLength: 1, maxLength: 15 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (history, question) => {
            const result = chatService.buildPrompt(minimalKb, history, question);

            // System prompt should be a non-empty string
            expect(typeof result.system).toBe('string');
            expect(result.system.length).toBeGreaterThan(0);

            // System prompt should contain KB data as JSON
            expect(result.system).toContain('technologies');
            expect(result.system).toContain('modules');
            expect(result.system).toContain('endpoints');
            expect(result.system).toContain('components');
            expect(result.system).toContain('entities');
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
