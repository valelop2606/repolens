import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../upload/context/SessionContext';
import type { Component, Endpoint, Entity, FlowStep, FeatureFlow } from '../../../shared/types';

// --- Styles ---

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    minHeight: 'calc(100vh - 5rem)',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  } as React.CSSProperties,
  mainPanel: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem',
  } as React.CSSProperties,
  codePanel: {
    width: '360px',
    minWidth: '360px',
    backgroundColor: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
    overflowY: 'auto',
    padding: '1.5rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 1.5rem 0',
  } as React.CSSProperties,
  selectorContainer: {
    marginBottom: '2rem',
  } as React.CSSProperties,
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.5rem',
    display: 'block',
  } as React.CSSProperties,
  select: {
    width: '100%',
    maxWidth: '480px',
    padding: '0.625rem 1rem',
    fontSize: '0.875rem',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    backgroundColor: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    outline: 'none',
  } as React.CSSProperties,
  flowContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0',
  } as React.CSSProperties,
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  } as React.CSSProperties,
  stepConnector: {
    width: '2px',
    height: '24px',
    backgroundColor: 'var(--border-strong)',
    marginLeft: '18px',
  } as React.CSSProperties,
  stepDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: '2px solid var(--accent)',
    backgroundColor: 'var(--surface)',
    flexShrink: 0,
  } as React.CSSProperties,
  stepDotResolved: {
    backgroundColor: 'var(--accent)',
  } as React.CSSProperties,
  stepDotUnresolved: {
    borderColor: 'var(--subtle)',
    backgroundColor: 'var(--surface-2)',
  } as React.CSSProperties,
  stepContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    color: 'var(--text)',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,
  stepContentActive: {
    backgroundColor: 'var(--accent-soft)',
    border: '1px solid var(--accent-border)',
  } as React.CSSProperties,
  stepLink: {
    color: 'var(--accent)',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  stepUnresolved: {
    color: 'var(--subtle)',
    fontStyle: 'italic',
  } as React.CSSProperties,
  layerBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  } as React.CSSProperties,
  codePanelTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '0.75rem',
  } as React.CSSProperties,
  codeSnippet: {
    backgroundColor: 'var(--surface-2)',
    borderRadius: '6px',
    padding: '1rem',
    fontSize: '0.8125rem',
    fontFamily: 'var(--mono)',
    color: 'var(--text-2)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: 'var(--subtle)',
    fontSize: '1rem',
  } as React.CSSProperties,
};

const layerColors: Record<string, string> = {
  'ui-screen': '#8b5cf6',
  'component': '#6366f1',
  'api-request': '#0ea5e9',
  'route': '#14b8a6',
  'controller': '#22c55e',
  'service': '#f59e0b',
  'database': '#ef4444',
  'response': 'var(--muted)',
};

// --- Helper: determine if a component is a page/screen ---

function isPageComponent(comp: Component): boolean {
  const name = comp.name.toLowerCase();
  const hasPageIndicator =
    name.includes('page') ||
    name.includes('screen') ||
    name.includes('view');
  const isRootComponent = comp.parents.length === 0;
  return hasPageIndicator || isRootComponent;
}

// --- Helper: match a URL pattern to an endpoint ---

function matchUrlToEndpoint(
  url: string,
  method: string | null,
  endpoints: Endpoint[],
): Endpoint | null {
  // Normalize URL by removing base URL patterns and query params
  const normalizedUrl = url
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '');

  for (const ep of endpoints) {
    const epPath = ep.path.replace(/\/+$/, '');
    // Convert route params like :id to a pattern
    const pattern = epPath.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`, 'i');

    if (regex.test(normalizedUrl)) {
      if (method && ep.method.toUpperCase() !== method.toUpperCase()) {
        continue;
      }
      return ep;
    }
  }
  return null;
}

// --- Helper: find entities referenced by a service file ---

function findEntitiesByServiceFile(
  serviceFile: string | null,
  entities: Entity[],
): Entity[] {
  if (!serviceFile) return [];
  // Heuristic: match entities whose sourceFile shares the same directory
  // or whose name appears in the service file path
  const serviceDir = serviceFile.replace(/[/\\][^/\\]+$/, '');
  return entities.filter((ent) => {
    const entDir = ent.sourceFile.replace(/[/\\][^/\\]+$/, '');
    return entDir === serviceDir ||
      serviceFile.toLowerCase().includes(ent.name.toLowerCase());
  });
}

// --- Flow construction ---

interface SelectionOption {
  id: string;
  type: 'component' | 'endpoint';
  label: string;
}

function buildFlowFromComponent(
  component: Component,
  endpoints: Endpoint[],
  entities: Entity[],
): FeatureFlow {
  const steps: FlowStep[] = [];

  // Step 1: UI Screen
  steps.push({
    layer: 'ui-screen',
    entityId: component.id,
    entityType: 'component',
    label: component.name,
    resolved: true,
  });

  // Step 2: API Requests from the component
  if (component.apiCalls.length > 0) {
    for (const call of component.apiCalls) {
      steps.push({
        layer: 'api-request',
        entityId: null,
        entityType: null,
        label: `${call.method ?? 'GET'} ${call.url}`,
        resolved: true,
      });

      // Step 3: Match to endpoint
      const matched = matchUrlToEndpoint(call.url, call.method, endpoints);
      if (matched) {
        steps.push({
          layer: 'route',
          entityId: matched.id,
          entityType: 'endpoint',
          label: `${matched.method} ${matched.path}`,
          resolved: true,
        });

        // Step 4: Service
        if (matched.serviceFunction) {
          steps.push({
            layer: 'service',
            entityId: matched.id,
            entityType: 'endpoint',
            label: `${matched.serviceFunction}${matched.serviceFile ? ` (${matched.serviceFile})` : ''}`,
            resolved: true,
          });

          // Step 5: Database entities
          const relatedEntities = findEntitiesByServiceFile(matched.serviceFile, entities);
          if (relatedEntities.length > 0) {
            for (const ent of relatedEntities) {
              steps.push({
                layer: 'database',
                entityId: ent.id,
                entityType: 'entity',
                label: ent.name,
                resolved: true,
              });
            }
          } else {
            steps.push({
              layer: 'database',
              entityId: null,
              entityType: null,
              label: 'Unknown entity',
              resolved: false,
            });
          }
        } else {
          steps.push({
            layer: 'service',
            entityId: null,
            entityType: null,
            label: 'Unknown service',
            resolved: false,
          });
        }
      } else {
        steps.push({
          layer: 'route',
          entityId: null,
          entityType: null,
          label: 'Unresolved endpoint',
          resolved: false,
        });
      }
    }
  } else {
    steps.push({
      layer: 'api-request',
      entityId: null,
      entityType: null,
      label: 'No API calls detected',
      resolved: false,
    });
  }

  // Response step
  steps.push({
    layer: 'response',
    entityId: component.id,
    entityType: 'component',
    label: `Response → ${component.name}`,
    resolved: true,
  });

  return {
    id: `flow-${component.id}`,
    name: `Flow: ${component.name}`,
    steps,
  };
}

function buildFlowFromEndpoint(
  endpoint: Endpoint,
  components: Component[],
  entities: Entity[],
): FeatureFlow {
  const steps: FlowStep[] = [];

  // Step 1: Find components that call this endpoint
  const callers = components.filter((comp) =>
    comp.apiCalls.some((call) => {
      const matched = matchUrlToEndpoint(call.url, call.method, [endpoint]);
      return matched !== null;
    }),
  );

  if (callers.length > 0) {
    for (const caller of callers) {
      steps.push({
        layer: 'ui-screen',
        entityId: caller.id,
        entityType: 'component',
        label: caller.name,
        resolved: true,
      });
    }
  } else {
    steps.push({
      layer: 'ui-screen',
      entityId: null,
      entityType: null,
      label: 'Unknown caller',
      resolved: false,
    });
  }

  // API request step
  steps.push({
    layer: 'api-request',
    entityId: null,
    entityType: null,
    label: `${endpoint.method} ${endpoint.path}`,
    resolved: true,
  });

  // Route step
  steps.push({
    layer: 'route',
    entityId: endpoint.id,
    entityType: 'endpoint',
    label: `${endpoint.method} ${endpoint.path}`,
    resolved: true,
  });

  // Service step
  if (endpoint.serviceFunction) {
    steps.push({
      layer: 'service',
      entityId: endpoint.id,
      entityType: 'endpoint',
      label: `${endpoint.serviceFunction}${endpoint.serviceFile ? ` (${endpoint.serviceFile})` : ''}`,
      resolved: true,
    });

    // Database entities
    const relatedEntities = findEntitiesByServiceFile(endpoint.serviceFile, entities);
    if (relatedEntities.length > 0) {
      for (const ent of relatedEntities) {
        steps.push({
          layer: 'database',
          entityId: ent.id,
          entityType: 'entity',
          label: ent.name,
          resolved: true,
        });
      }
    } else {
      steps.push({
        layer: 'database',
        entityId: null,
        entityType: null,
        label: 'Unknown entity',
        resolved: false,
      });
    }
  } else {
    steps.push({
      layer: 'service',
      entityId: null,
      entityType: null,
      label: 'Unknown service',
      resolved: false,
    });
  }

  // Response
  steps.push({
    layer: 'response',
    entityId: null,
    entityType: null,
    label: 'Response',
    resolved: true,
  });

  return {
    id: `flow-${endpoint.id}`,
    name: `Flow: ${endpoint.method} ${endpoint.path}`,
    steps,
  };
}

// --- Main Component ---

const FeatureFlowView: React.FC = () => {
  const { knowledgeBase, sessionId } = useSession();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [selectedOption, setSelectedOption] = useState<string>('');
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  // Build selection options
  const options: SelectionOption[] = useMemo(() => {
    if (!knowledgeBase) return [];
    const opts: SelectionOption[] = [];

    // Page/screen components
    knowledgeBase.components
      .filter(isPageComponent)
      .forEach((comp) => {
        opts.push({
          id: comp.id,
          type: 'component',
          label: `[Component] ${comp.name}`,
        });
      });

    // All endpoints
    knowledgeBase.endpoints.forEach((ep) => {
      opts.push({
        id: ep.id,
        type: 'endpoint',
        label: `[Endpoint] ${ep.method} ${ep.path}`,
      });
    });

    return opts;
  }, [knowledgeBase]);

  // Build flow based on selection
  const flow: FeatureFlow | null = useMemo(() => {
    if (!knowledgeBase || !selectedOption) return null;
    const option = options.find((o) => `${o.type}:${o.id}` === selectedOption);
    if (!option) return null;

    if (option.type === 'component') {
      const comp = knowledgeBase.components.find((c) => c.id === option.id);
      if (!comp) return null;
      return buildFlowFromComponent(comp, knowledgeBase.endpoints, knowledgeBase.entities);
    } else {
      const ep = knowledgeBase.endpoints.find((e) => e.id === option.id);
      if (!ep) return null;
      return buildFlowFromEndpoint(ep, knowledgeBase.components, knowledgeBase.entities);
    }
  }, [knowledgeBase, selectedOption, options]);

  // Get source info for active step
  const activeStepInfo = useMemo(() => {
    if (activeStepIndex === null || !flow || !knowledgeBase) return null;
    const step = flow.steps[activeStepIndex];
    if (!step || !step.resolved || !step.entityId) return null;

    if (step.entityType === 'endpoint') {
      const ep = knowledgeBase.endpoints.find((e) => e.id === step.entityId);
      if (ep) return { file: ep.sourceFile, line: ep.lineNumber };
    } else if (step.entityType === 'component') {
      const comp = knowledgeBase.components.find((c) => c.id === step.entityId);
      if (comp) return { file: comp.filePath, line: 1 };
    } else if (step.entityType === 'entity') {
      const ent = knowledgeBase.entities.find((e) => e.id === step.entityId);
      if (ent) return { file: ent.sourceFile, line: 1 };
    }
    return null;
  }, [activeStepIndex, flow, knowledgeBase]);

  // Navigate to explorer for a given entity
  const navigateToExplorer = useCallback(
    (entityId: string, entityType: string) => {
      const sessionPath = id || sessionId;
      navigate(`/session/${sessionPath}/explore`, {
        state: { selectedId: entityId, selectedType: entityType },
      });
    },
    [navigate, id, sessionId],
  );

  const handleStepClick = useCallback((index: number) => {
    setActiveStepIndex((prev) => (prev === index ? null : index));
  }, []);

  if (!knowledgeBase) {
    return (
      <div style={styles.emptyState}>
        <p>Loading project data...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Main Panel */}
      <div style={styles.mainPanel}>
        <h2 style={styles.title}>Feature Flow Tracer</h2>

        {/* Flow Selector */}
        <div style={styles.selectorContainer}>
          <label style={styles.label} htmlFor="flow-selector">
            Select a starting point
          </label>
          <select
            id="flow-selector"
            style={styles.select}
            value={selectedOption}
            onChange={(e) => {
              setSelectedOption(e.target.value);
              setActiveStepIndex(null);
            }}
          >
            <option value="">-- Choose a component or endpoint --</option>
            {options.map((opt) => (
              <option key={`${opt.type}:${opt.id}`} value={`${opt.type}:${opt.id}`}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Flow Diagram */}
        {flow ? (
          <div style={styles.flowContainer} role="list" aria-label="Feature flow steps">
            {flow.steps.map((step, index) => (
              <React.Fragment key={index}>
                {index > 0 && <div style={styles.stepConnector} aria-hidden="true" />}
                <div style={styles.stepRow} role="listitem">
                  <div
                    style={{
                      ...styles.stepDot,
                      ...(step.resolved ? styles.stepDotResolved : styles.stepDotUnresolved),
                    }}
                    aria-hidden="true"
                  />
                  <div
                    style={{
                      ...styles.stepContent,
                      ...(activeStepIndex === index ? styles.stepContentActive : {}),
                    }}
                    onClick={() => handleStepClick(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleStepClick(index);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${step.layer}: ${step.label}${step.resolved ? '' : ' (unresolved)'}`}
                  >
                    <span
                      style={{
                        ...styles.layerBadge,
                        backgroundColor: layerColors[step.layer] ?? '#6b7280',
                      }}
                    >
                      {step.layer}
                    </span>
                    {step.resolved && step.entityId && step.entityType ? (
                      <span
                        style={styles.stepLink}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToExplorer(step.entityId!, step.entityType!);
                        }}
                        role="link"
                        tabIndex={0}
                      >
                        {step.label}
                      </span>
                    ) : step.resolved ? (
                      <span>{step.label}</span>
                    ) : (
                      <span style={styles.stepUnresolved}>{step.label}</span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--subtle)', fontSize: '0.875rem' }}>
            Select a component or endpoint above to trace its feature flow.
          </div>
        )}
      </div>

      {/* Code Snippet Panel */}
      <aside style={styles.codePanel} aria-label="Source code details">
        <div style={styles.codePanelTitle}>Source Details</div>
        {activeStepInfo ? (
          <div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>FILE</span>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                {activeStepInfo.file}
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>LINE</span>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)', marginTop: '0.25rem' }}>
                {activeStepInfo.line}
              </div>
            </div>
            <div style={styles.codeSnippet}>
              {activeStepInfo.file}:{activeStepInfo.line}
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--subtle)', fontSize: '0.8125rem' }}>
            Click a flow step to see its source file and line number.
          </div>
        )}
      </aside>
    </div>
  );
};

export default FeatureFlowView;
