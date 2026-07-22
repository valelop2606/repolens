import React, { useState, useCallback } from 'react';
import { useSession } from '../../upload/context/SessionContext';
import { getDoc } from '../../upload/services/api.client';

// --- Types ---

interface DocOption {
  label: string;
  type: string;
  filename: string;
  description: string;
}

const DOC_OPTIONS: DocOption[] = [
  {
    label: 'README',
    type: 'readme',
    filename: 'README.md',
    description: 'Project overview, setup instructions, and getting started guide.',
  },
  {
    label: 'Architecture Summary',
    type: 'architecture',
    filename: 'architecture.md',
    description: 'High-level architecture, modules, and system design overview.',
  },
  {
    label: 'API Docs',
    type: 'api',
    filename: 'api-docs.md',
    description: 'API endpoints, request/response formats, and usage examples.',
  },
  {
    label: 'Learning Guide',
    type: 'learning-guide',
    filename: 'learning-guide.md',
    description: 'Step-by-step guide to understand and navigate the codebase.',
  },
];

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
  content: {
    flex: 1,
    padding: '2rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.5rem',
    alignContent: 'start',
  } as React.CSSProperties,
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#1e293b',
    margin: 0,
  } as React.CSSProperties,
  cardDescription: {
    fontSize: '0.8125rem',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.5,
  } as React.CSSProperties,
  downloadButton: {
    marginTop: 'auto',
    padding: '0.625rem 1.25rem',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center',
  } as React.CSSProperties,
  downloadButtonDisabled: {
    backgroundColor: '#94a3b8',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minHeight: 'calc(100vh - 64px)',
    color: '#94a3b8',
    fontSize: '0.9375rem',
    textAlign: 'center',
    gap: '0.5rem',
  } as React.CSSProperties,
  errorBanner: {
    margin: '1rem 2rem 0',
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

// --- Component ---

const DocsView: React.FC = () => {
  const { sessionId } = useSession();
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(
    async (type: string, filename: string) => {
      if (!sessionId || loadingType) return;

      setError(null);
      setLoadingType(type);

      try {
        const content = await getDoc(sessionId, type);

        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();

        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to download document. Please try again.';
        setError(message);
      } finally {
        setLoadingType(null);
      }
    },
    [sessionId, loadingType],
  );

  const handleDismissError = () => {
    setError(null);
  };

  if (!sessionId) {
    return (
      <div style={styles.emptyState}>
        <span style={{ fontSize: '2rem' }}>📄</span>
        <p>No active session. Upload a repository first.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Documentation</h1>
        <p style={styles.headerSubtitle}>
          Download generated documentation for the analyzed repository.
        </p>
      </div>

      {error && (
        <div style={styles.errorBanner} role="alert">
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

      <div style={styles.content}>
        {DOC_OPTIONS.map((doc) => {
          const isLoading = loadingType === doc.type;
          const isDisabled = loadingType !== null;

          return (
            <div key={doc.type} style={styles.card}>
              <h2 style={styles.cardTitle}>{doc.label}</h2>
              <p style={styles.cardDescription}>{doc.description}</p>
              <button
                style={{
                  ...styles.downloadButton,
                  ...(isDisabled ? styles.downloadButtonDisabled : {}),
                }}
                onClick={() => handleDownload(doc.type, doc.filename)}
                disabled={isDisabled}
                aria-label={`Download ${doc.label}`}
              >
                {isLoading ? 'Downloading...' : `Download ${doc.filename}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DocsView;
