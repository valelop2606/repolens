import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../upload/context/SessionContext';
import { askQuestion } from '../../upload/services/api.client';
import type { Message, EntityCitation } from '../../../shared/types';

// --- Styles ---

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 'calc(100vh - 64px)',
    backgroundColor: '#f8fafc',
  } as React.CSSProperties,
  header: {
    padding: '1rem 2rem',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
  } as React.CSSProperties,
  headerTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#1e293b',
    margin: 0,
  } as React.CSSProperties,
  headerSubtitle: {
    fontSize: '0.8125rem',
    color: '#64748b',
    margin: '0.25rem 0 0 0',
  } as React.CSSProperties,
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#94a3b8',
    fontSize: '0.9375rem',
    textAlign: 'center',
    gap: '0.5rem',
  } as React.CSSProperties,
  messageUser: {
    alignSelf: 'flex-end',
    maxWidth: '70%',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: '#eff6ff',
    borderLeft: '3px solid #3b82f6',
    fontSize: '0.9375rem',
    color: '#1e293b',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  } as React.CSSProperties,
  messageAssistant: {
    alignSelf: 'flex-start',
    maxWidth: '70%',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    borderLeft: '3px solid #10b981',
    fontSize: '0.9375rem',
    color: '#1e293b',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  } as React.CSSProperties,
  messageRole: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem',
  } as React.CSSProperties,
  citationsContainer: {
    marginTop: '0.5rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid #e2e8f0',
  } as React.CSSProperties,
  citationsLabel: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem',
  } as React.CSSProperties,
  citationLink: {
    color: '#3b82f6',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '0.8125rem',
    marginRight: '0.75rem',
    display: 'inline-block',
    marginBottom: '0.25rem',
  } as React.CSSProperties,
  inputArea: {
    padding: '1rem 2rem',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-end',
  } as React.CSSProperties,
  textarea: {
    flex: 1,
    padding: '0.625rem 0.875rem',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
    resize: 'none',
    minHeight: '40px',
    maxHeight: '120px',
    lineHeight: 1.5,
    outline: 'none',
    color: '#1e293b',
  } as React.CSSProperties,
  sendButton: {
    padding: '0.625rem 1.25rem',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  loadingIndicator: {
    alignSelf: 'flex-start',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#64748b',
    fontSize: '0.875rem',
    padding: '0.5rem 0',
  } as React.CSSProperties,
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #e2e8f0',
    borderTop: '2px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,
  errorBanner: {
    margin: '0 2rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
  errorText: {
    color: '#dc2626',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  errorDismiss: {
    color: '#dc2626',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    fontSize: '1.25rem',
    lineHeight: 1,
    padding: '0 0.25rem',
  } as React.CSSProperties,
};

// --- Spinner keyframes injection ---

const spinnerStyleId = 'ai-assistant-spinner-style';

function ensureSpinnerKeyframes(): void {
  if (document.getElementById(spinnerStyleId)) return;
  const style = document.createElement('style');
  style.id = spinnerStyleId;
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

// --- Types ---

interface ChatMessage extends Message {
  citations?: EntityCitation[];
}

// --- ChatHistory Component ---

const ChatHistory: React.FC<{
  messages: ChatMessage[];
  sessionId: string;
  onCitationClick: (citation: EntityCitation) => void;
}> = ({ messages, onCitationClick }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div style={styles.emptyState}>
        <span style={{ fontSize: '2rem' }}>💬</span>
        <p>Ask any question about the analyzed codebase.</p>
        <p style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
          The AI assistant will answer using the Knowledge Base.
        </p>
      </div>
    );
  }

  return (
    <>
      {messages.map((msg, idx) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={idx}
            style={isUser ? styles.messageUser : styles.messageAssistant}
          >
            <div style={styles.messageRole}>
              {isUser ? 'You' : 'Assistant'}
            </div>
            <div>{msg.content}</div>
            {!isUser && msg.citations && msg.citations.length > 0 && (
              <div style={styles.citationsContainer}>
                <div style={styles.citationsLabel}>References</div>
                {msg.citations.map((citation, cIdx) => (
                  <span
                    key={cIdx}
                    style={styles.citationLink}
                    onClick={() => onCitationClick(citation)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onCitationClick(citation);
                    }}
                  >
                    {citation.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </>
  );
};

// --- MessageInput Component ---

const MessageInput: React.FC<{
  onSubmit: (text: string) => void;
  disabled: boolean;
}> = ({ onSubmit, disabled }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div style={styles.inputArea}>
      <textarea
        ref={textareaRef}
        style={styles.textarea}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about the codebase..."
        disabled={disabled}
        rows={1}
        aria-label="Message input"
      />
      <button
        style={{
          ...styles.sendButton,
          ...(disabled || !text.trim() ? styles.sendButtonDisabled : {}),
        }}
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        aria-label="Send message"
      >
        Send
      </button>
    </div>
  );
};

// --- Main AIAssistantView Component ---

const AIAssistantView: React.FC = () => {
  const { sessionId } = useSession();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSpinnerKeyframes();
  }, []);

  const handleCitationClick = useCallback(
    (citation: EntityCitation) => {
      if (!sessionId) return;
      const params = new URLSearchParams({
        type: citation.entityType,
        id: citation.entityId,
      });
      navigate(`/session/${sessionId}/explore?${params.toString()}`);
    },
    [sessionId, navigate],
  );

  const handleSendMessage = useCallback(
    async (question: string) => {
      if (!sessionId) return;

      setError(null);

      const userMessage: ChatMessage = {
        role: 'user',
        content: question,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      try {
        // Build history from existing messages (without citations field for API)
        const history: Message[] = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));

        const response = await askQuestion(sessionId, history, question);

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          citations: response.citations,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to get a response. Please try again.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, messages],
  );

  const handleDismissError = () => {
    setError(null);
  };

  if (!sessionId) {
    return (
      <div style={styles.emptyState}>
        <p>No active session. Upload a repository first.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>AI Assistant</h1>
        <p style={styles.headerSubtitle}>
          Ask questions about the analyzed codebase. Answers are grounded in the Knowledge Base.
        </p>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          <span style={styles.errorText}>{error}</span>
          <button
            style={styles.errorDismiss}
            onClick={handleDismissError}
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      <div style={styles.chatArea}>
        <ChatHistory
          messages={messages}
          sessionId={sessionId}
          onCitationClick={handleCitationClick}
        />
        {loading && (
          <div style={styles.loadingIndicator}>
            <div style={styles.spinner} />
            <span>Thinking...</span>
          </div>
        )}
      </div>

      <MessageInput onSubmit={handleSendMessage} disabled={loading} />
    </div>
  );
};

export default AIAssistantView;
