import React, { createContext, useContext, useState, useCallback } from 'react';
import type { KnowledgeBase } from '../../../shared/types';

interface SessionContextValue {
  knowledgeBase: KnowledgeBase | null;
  sessionId: string | null;
  setSession: (sessionId: string, kb: KnowledgeBase) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const setSession = useCallback((id: string, kb: KnowledgeBase) => {
    setSessionId(id);
    setKnowledgeBase(kb);
  }, []);

  const clearSession = useCallback(() => {
    setSessionId(null);
    setKnowledgeBase(null);
  }, []);

  return (
    <SessionContext.Provider
      value={{ knowledgeBase, sessionId, setSession, clearSession }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
