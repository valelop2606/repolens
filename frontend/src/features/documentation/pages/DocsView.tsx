import React, { useState, useCallback } from 'react';
import { useSession } from '../../upload/context/SessionContext';
import { getDoc } from '../../upload/services/api.client';
import Icon, { type IconName } from '../../../shared/ui/Icon';

// --- Types ---

interface DocOption {
  label: string;
  type: string;
  filename: string;
  description: string;
  icon: IconName;
}

const DOC_OPTIONS: DocOption[] = [
  {
    label: 'README',
    type: 'readme',
    icon: 'doc',
    filename: 'README.md',
    description: 'Project overview, setup instructions, and getting started guide.',
  },
  {
    label: 'Architecture Summary',
    type: 'architecture',
    icon: 'layers',
    filename: 'architecture.md',
    description: 'High-level architecture, modules, and system design overview.',
  },
  {
    label: 'API Docs',
    type: 'api',
    icon: 'plug',
    filename: 'api-docs.md',
    description: 'API endpoints, request/response formats, and usage examples.',
  },
  {
    label: 'Learning Guide',
    type: 'learning-guide',
    icon: 'route',
    filename: 'learning-guide.md',
    description: 'Step-by-step guide to understand and navigate the codebase.',
  },
];

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
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 300, color: 'var(--muted)' }}>
        No active session. Upload a repository first.
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <header className="page-header">
        <div>
          <div className="eyebrow">Documentation</div>
          <h1>Generated docs</h1>
          <p>Markdown documents generated from the analysis. Download and drop them into your repo.</p>
        </div>
      </header>

      {error && (
        <div className="alert alert-danger" role="alert" style={{ marginBottom: '1.25rem', alignItems: 'center' }}>
          <Icon name="alert" size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button className="btn btn-ghost" style={{ height: 28, padding: '0 0.375rem', color: 'inherit' }} onClick={handleDismissError} aria-label="Dismiss error">
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      <div className="grid-2" style={{ gap: '1rem' }}>
        {DOC_OPTIONS.map((doc) => {
          const isLoading = loadingType === doc.type;
          const isDisabled = loadingType !== null;

          return (
            <div key={doc.type} className="card doc-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="doc-icon">
                  <Icon name={doc.icon} size={18} />
                </span>
                <span className="filename">{doc.filename}</span>
              </div>
              <h2>{doc.label}</h2>
              <p>{doc.description}</p>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => handleDownload(doc.type, doc.filename)}
                disabled={isDisabled}
                aria-label={`Download ${doc.label}`}
              >
                {isLoading ? <span className="spinner" /> : <Icon name="download" size={16} />}
                {isLoading ? 'Generating…' : 'Download'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DocsView;
