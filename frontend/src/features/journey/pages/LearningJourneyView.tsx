import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from '../../upload/context/SessionContext';
import { calculateProgress } from '../utils/calculateProgress';
import type { KnowledgeBase } from '../../../shared/types';

// --- Stage definitions ---

export interface Stage {
  id: string;
  label: string;
  description: string;
}

const STAGES: Stage[] = [
  { id: 'project-overview', label: 'Project Overview', description: 'General project info, dependencies, and technologies' },
  { id: 'architecture', label: 'Architecture', description: 'Module structure and dependency relationships' },
  { id: 'business-modules', label: 'Business Modules', description: 'Individual modules and their responsibilities' },
  { id: 'authentication', label: 'Authentication', description: 'Auth-related modules and security endpoints' },
  { id: 'core-features', label: 'Core Features', description: 'React components and UI features' },
  { id: 'api', label: 'API', description: 'Backend endpoints and routes' },
  { id: 'database', label: 'Database', description: 'Database entities and relationships' },
  { id: 'ready', label: 'Ready for your first task', description: 'Summary and next steps' },
];

const TOTAL_STAGES = STAGES.length;

// --- LocalStorage helpers ---

function getStorageKey(sessionId: string | null): string {
  return `learning-journey-completed-${sessionId ?? 'default'}`;
}

function loadCompletedStages(sessionId: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(getStorageKey(sessionId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

function saveCompletedStages(sessionId: string | null, completed: Set<string>): void {
  localStorage.setItem(getStorageKey(sessionId), JSON.stringify([...completed]));
}

// --- Stage content rendering ---

function renderStageContent(stageId: string, kb: KnowledgeBase | null): React.ReactNode {
  if (!kb) {
    return <p style={{ color: '#64748b' }}>No knowledge base available.</p>;
  }

  switch (stageId) {
    case 'project-overview': {
      const { metadata, technologies } = kb;
      return (
        <div>
          <p><strong>Project:</strong> {metadata.name} v{metadata.version}</p>
          {metadata.description && <p>{metadata.description}</p>}
          <p><strong>Dependencies:</strong> {Object.keys(metadata.dependencies).length} packages</p>
          {technologies.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {technologies.map((tech) => (
                <span key={tech.name} style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', backgroundColor: '#e0f2fe', fontSize: '0.8rem' }}>
                  {tech.name}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: '#94a3b8' }}>No technologies detected.</p>
          )}
        </div>
      );
    }

    case 'architecture': {
      const { modules, dependencyGraph } = kb;
      if (modules.length === 0 && dependencyGraph.nodes.length === 0) {
        return <p style={{ color: '#94a3b8' }}>Architecture information is not available for this project.</p>;
      }
      return (
        <div>
          <p><strong>Modules:</strong> {modules.length}</p>
          <p><strong>Dependency edges:</strong> {dependencyGraph.edges.length}</p>
          {dependencyGraph.edges.some((e) => e.isCircular) && (
            <p style={{ color: '#f59e0b' }}>Warning: Circular dependencies detected.</p>
          )}
        </div>
      );
    }

    case 'business-modules': {
      const { modules } = kb;
      if (modules.length === 0) {
        return <p style={{ color: '#94a3b8' }}>No business modules detected in this project.</p>;
      }
      return (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {modules.map((mod) => (
            <li key={mod.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}>
              <strong>{mod.name}</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>{mod.description}</p>
            </li>
          ))}
        </ul>
      );
    }

    case 'authentication': {
      const authModules = kb.modules.filter((m) =>
        m.name.toLowerCase().includes('auth') || m.name.toLowerCase().includes('security')
      );
      const authEndpoints = kb.endpoints.filter((e) =>
        e.path.toLowerCase().includes('auth') || e.path.toLowerCase().includes('login') || e.path.toLowerCase().includes('register')
      );

      if (authModules.length === 0 && authEndpoints.length === 0) {
        return <p style={{ color: '#94a3b8' }}>No authentication layer detected in this project.</p>;
      }

      return (
        <div>
          {authModules.length > 0 && (
            <div>
              <p><strong>Auth Modules:</strong></p>
              <ul style={{ paddingLeft: '1.5rem' }}>
                {authModules.map((m) => <li key={m.id}>{m.name}</li>)}
              </ul>
            </div>
          )}
          {authEndpoints.length > 0 && (
            <div>
              <p><strong>Auth Endpoints:</strong></p>
              <ul style={{ paddingLeft: '1.5rem' }}>
                {authEndpoints.map((e) => <li key={e.id}>{e.method} {e.path}</li>)}
              </ul>
            </div>
          )}
        </div>
      );
    }

    case 'core-features': {
      const { components } = kb;
      if (components.length === 0) {
        return <p style={{ color: '#94a3b8' }}>No React components detected in this project.</p>;
      }
      return (
        <div>
          <p><strong>Components found:</strong> {components.length}</p>
          <ul style={{ paddingLeft: '1.5rem' }}>
            {components.slice(0, 10).map((c) => (
              <li key={c.id}>{c.name} ({c.type})</li>
            ))}
            {components.length > 10 && <li style={{ color: '#64748b' }}>...and {components.length - 10} more</li>}
          </ul>
        </div>
      );
    }

    case 'api': {
      const { endpoints } = kb;
      if (endpoints.length === 0) {
        return <p style={{ color: '#94a3b8' }}>No API endpoints detected in this project.</p>;
      }
      return (
        <div>
          <p><strong>Endpoints found:</strong> {endpoints.length}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {endpoints.slice(0, 10).map((ep) => (
              <li key={ep.id} style={{ marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>{ep.method}</span> {ep.path}
              </li>
            ))}
            {endpoints.length > 10 && <li style={{ color: '#64748b', fontSize: '0.875rem' }}>...and {endpoints.length - 10} more</li>}
          </ul>
        </div>
      );
    }

    case 'database': {
      const { entities } = kb;
      if (entities.length === 0) {
        return <p style={{ color: '#94a3b8' }}>No database entities detected in this project.</p>;
      }
      return (
        <div>
          <p><strong>Entities found:</strong> {entities.length}</p>
          <ul style={{ paddingLeft: '1.5rem' }}>
            {entities.map((entity) => (
              <li key={entity.id}>
                {entity.name} ({entity.ormType}) — {entity.fields.length} fields
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case 'ready': {
      return (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <h3 style={{ color: '#16a34a', margin: '0 0 0.5rem' }}>Congratulations!</h3>
          <p style={{ color: '#475569' }}>
            You have completed the Learning Journey for <strong>{kb.metadata.name}</strong>.
            You now have a high-level understanding of the project architecture, modules, APIs, and data layer.
          </p>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            You are ready to start contributing to this codebase.
          </p>
        </div>
      );
    }

    default:
      return <p style={{ color: '#64748b' }}>Unknown stage.</p>;
  }
}

// --- Main Component ---

const LearningJourneyView: React.FC = () => {
  const { knowledgeBase, sessionId } = useSession();
  const [completedStages, setCompletedStages] = useState<Set<string>>(() => loadCompletedStages(sessionId));
  const [selectedStageId, setSelectedStageId] = useState<string>(STAGES[0].id);

  // Reload completed stages when sessionId changes
  useEffect(() => {
    setCompletedStages(loadCompletedStages(sessionId));
  }, [sessionId]);

  // Persist to localStorage whenever completed stages change
  useEffect(() => {
    saveCompletedStages(sessionId, completedStages);
  }, [completedStages, sessionId]);

  const handleStageClick = useCallback((stageId: string) => {
    setSelectedStageId(stageId);
    setCompletedStages((prev) => {
      const next = new Set(prev);
      next.add(stageId);
      return next;
    });
  }, []);

  const progress = calculateProgress(completedStages.size, TOTAL_STAGES);

  if (!knowledgeBase) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>Loading project data...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#1e293b' }}>Learning Journey</h1>
        <p style={{ marginTop: '0.5rem', color: '#475569' }}>
          Walk through each layer of the project to build your understanding step by step.
        </p>
      </header>

      {/* Progress Bar */}
      <section aria-labelledby="progress-heading" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 id="progress-heading" style={{ fontSize: '1rem', margin: 0, color: '#334155' }}>Progress</h2>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2563eb' }} aria-live="polite">
            {progress}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Learning journey progress: ${progress}%`}
          style={{
            width: '100%',
            height: '12px',
            backgroundColor: '#e2e8f0',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#2563eb',
              borderRadius: '6px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </section>

      {/* Stage List */}
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <nav aria-label="Learning journey stages" style={{ flex: '0 0 280px' }}>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {STAGES.map((stage, idx) => {
              const isCompleted = completedStages.has(stage.id);
              const isSelected = selectedStageId === stage.id;

              return (
                <li key={stage.id} style={{ marginBottom: '0.5rem' }}>
                  <button
                    onClick={() => handleStageClick(stage.id)}
                    aria-current={isSelected ? 'step' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      backgroundColor: isSelected ? '#eff6ff' : isCompleted ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: isCompleted ? '#16a34a' : '#e2e8f0',
                        color: isCompleted ? '#ffffff' : '#64748b',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {isCompleted ? '\u2713' : idx + 1}
                    </span>
                    <span style={{ color: '#1e293b', fontWeight: isSelected ? 600 : 400 }}>
                      {stage.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Stage Detail */}
        <section aria-label="Stage details" style={{ flex: 1, minWidth: '300px' }}>
          <div style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: '#ffffff' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: '#1e293b' }}>
              {STAGES.find((s) => s.id === selectedStageId)?.label}
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
              {STAGES.find((s) => s.id === selectedStageId)?.description}
            </p>
            <div>
              {renderStageContent(selectedStageId, knowledgeBase)}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LearningJourneyView;
