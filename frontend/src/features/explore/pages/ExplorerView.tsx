import React, { useState, useCallback } from 'react';
import { useSession } from '../../upload/context/SessionContext';
import type { Component, Endpoint, Entity, Module } from '../../../shared/types';

// --- Types ---

type EntityType = 'component' | 'endpoint' | 'entity' | 'module';

interface SelectedItem {
  type: EntityType;
  id: string;
}

// --- Styles ---

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    minHeight: 'calc(100vh - 64px)',
    backgroundColor: '#f8fafc',
  } as React.CSSProperties,
  sidebar: {
    width: '280px',
    minWidth: '280px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    overflowY: 'auto',
    padding: '1rem 0',
  } as React.CSSProperties,
  detailPanel: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem',
  } as React.CSSProperties,
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    userSelect: 'none',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  listItem: {
    padding: '0.4rem 1rem 0.4rem 1.5rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#334155',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    borderLeft: '3px solid transparent',
  } as React.CSSProperties,
  listItemActive: {
    backgroundColor: '#eff6ff',
    borderLeft: '3px solid #3b82f6',
    color: '#1d4ed8',
    fontWeight: 500,
  } as React.CSSProperties,
  listItemHover: {
    backgroundColor: '#f1f5f9',
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#94a3b8',
    fontSize: '1rem',
  } as React.CSSProperties,
  detailTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#1e293b',
    margin: '0 0 1.5rem 0',
  } as React.CSSProperties,
  detailSection: {
    marginBottom: '1.25rem',
  } as React.CSSProperties,
  detailLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem',
  } as React.CSSProperties,
  detailValue: {
    fontSize: '0.9375rem',
    color: '#1e293b',
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#fff',
  } as React.CSSProperties,
  chip: {
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    backgroundColor: '#e2e8f0',
    color: '#475569',
    marginRight: '0.4rem',
    marginBottom: '0.4rem',
  } as React.CSSProperties,
  link: {
    color: '#3b82f6',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '0.5rem 0.75rem',
    borderBottom: '2px solid #e2e8f0',
    color: '#64748b',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  td: {
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
  } as React.CSSProperties,
};

const methodColors: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
};

// --- Collapsible Section ---

const CollapsibleSection: React.FC<{
  title: string;
  count: number;
  children: React.ReactNode;
}> = ({ title, count, children }) => {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: '0.25rem' }}>
      <div
        style={styles.sectionHeader}
        onClick={() => setOpen(!open)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(!open); }}
      >
        <span>{title} ({count})</span>
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
      </div>
      {open && <div>{children}</div>}
    </div>
  );
};

// --- Detail Panels ---

const ComponentDetail: React.FC<{
  component: Component;
  allComponents: Component[];
  onNavigate: (id: string, type: EntityType) => void;
}> = ({ component, allComponents, onNavigate }) => {
  const resolveComponentName = (id: string) => {
    const found = allComponents.find((c) => c.id === id);
    return found?.name ?? id;
  };

  return (
    <div>
      <h2 style={styles.detailTitle}>{component.name}</h2>

      <div style={styles.detailSection}>
        <div style={styles.detailLabel}>File Path</div>
        <div style={styles.detailValue}>{component.filePath}</div>
      </div>

      <div style={styles.detailSection}>
        <div style={styles.detailLabel}>Component Type</div>
        <div style={styles.detailValue}>
          <span style={{ ...styles.badge, backgroundColor: component.type === 'functional' ? '#3b82f6' : '#8b5cf6' }}>
            {component.type}
          </span>
        </div>
      </div>

      <div style={styles.detailSection}>
        <div style={styles.detailLabel}>Parent Components</div>
        {component.parents.length === 0 ? (
          <div style={{ ...styles.detailValue, color: '#94a3b8' }}>None</div>
        ) : (
          <div>
            {component.parents.map((parentId) => (
              <span
                key={parentId}
                style={styles.link}
                onClick={() => onNavigate(parentId, 'component')}
              >
                {resolveComponentName(parentId)}
              </span>
            )).reduce<React.ReactNode[]>((acc, el, i) => {
              if (i > 0) acc.push(<span key={`sep-p-${i}`} style={{ margin: '0 0.5rem', color: '#cbd5e1' }}>•</span>);
              acc.push(el);
              return acc;
            }, [])}
          </div>
        )}
      </div>

      <div style={styles.detailSection}>
        <div style={styles.detailLabel}>Child Components</div>
        {component.children.length === 0 ? (
          <div style={{ ...styles.detailValue, color: '#94a3b8' }}>None</div>
        ) : (
          <div>
            {component.children.map((childId) => (
              <span
                key={childId}
                style={styles.link}
                onClick={() => onNavigate(childId, 'component')}
              >
                {resolveComponentName(childId)}
              </span>
            )).reduce<React.ReactNode[]>((acc, el, i) => {
              if (i > 0) acc.push(<span key={`sep-c-${i}`} style={{ margin: '0 0.5rem', color: '#cbd5e1' }}>•</span>);
              acc.push(el);
              return acc;
            }, [])}
          </div>
        )}
      </div>

      <div style={styles.detailSection}>
        <div style={styles.detailLabel}>API Calls</div>
        {component.apiCalls.length === 0 ? (
          <div style={{ ...styles.detailValue, color: '#94a3b8' }}>None</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {component.apiCalls.map((call, idx) => (
              <li key={idx} style={{ marginBottom: '0.35rem', fontSize: '0.875rem', color: '#334155' }}>
                {call.method && (
                  <span style={{ ...styles.badge, backgroundColor: methodColors[call.method.toUpperCase()] ?? '#6b7280', marginRight: '0.5rem' }}>
                    {call.method.toUpperCase()}
                  </span>
                )}
                <code style={{ backgroundColor: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>{call.url}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const EndpointDetail: React.FC<{ endpoint: Endpoint }> = ({ endpoint }) => (
  <div>
    <h2 style={styles.detailTitle}>
      <span style={{ ...styles.badge, backgroundColor: methodColors[endpoint.method] ?? '#6b7280', marginRight: '0.75rem', fontSize: '0.875rem' }}>
        {endpoint.method}
      </span>
      {endpoint.path}
    </h2>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>Source File</div>
      <div style={styles.detailValue}>{endpoint.sourceFile}</div>
    </div>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>Line Number</div>
      <div style={styles.detailValue}>{endpoint.lineNumber}</div>
    </div>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>Middlewares</div>
      {endpoint.middlewares.length === 0 ? (
        <div style={{ ...styles.detailValue, color: '#94a3b8' }}>None</div>
      ) : (
        <div>
          {endpoint.middlewares.map((mw, idx) => (
            <span key={idx} style={styles.chip}>{mw}</span>
          ))}
        </div>
      )}
    </div>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>Service Function</div>
      {endpoint.serviceFunction ? (
        <div style={styles.detailValue}>
          <code style={{ backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '3px' }}>
            {endpoint.serviceFunction}
          </code>
          {endpoint.serviceFile && (
            <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>
              ({endpoint.serviceFile})
            </span>
          )}
        </div>
      ) : (
        <div style={{ ...styles.detailValue, color: '#94a3b8' }}>Not linked</div>
      )}
    </div>
  </div>
);

const EntityDetail: React.FC<{ entity: Entity }> = ({ entity }) => (
  <div>
    <h2 style={styles.detailTitle}>{entity.name}</h2>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>ORM Type</div>
      <div style={styles.detailValue}>
        <span style={{ ...styles.badge, backgroundColor: entity.ormType === 'mongoose' ? '#22c55e' : entity.ormType === 'sequelize' ? '#3b82f6' : '#6b7280' }}>
          {entity.ormType}
        </span>
      </div>
    </div>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>Source File</div>
      <div style={styles.detailValue}>{entity.sourceFile}</div>
    </div>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>Fields</div>
      {entity.fields.length === 0 ? (
        <div style={{ ...styles.detailValue, color: '#94a3b8' }}>No fields detected</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Required</th>
            </tr>
          </thead>
          <tbody>
            {entity.fields.map((field, idx) => (
              <tr key={idx}>
                <td style={styles.td}>{field.name}</td>
                <td style={styles.td}><code>{field.type}</code></td>
                <td style={styles.td}>{field.required ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>Relationships</div>
      {entity.relationships.length === 0 ? (
        <div style={{ ...styles.detailValue, color: '#94a3b8' }}>No relationships</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {entity.relationships.map((rel, idx) => (
            <li key={idx} style={{ marginBottom: '0.4rem', fontSize: '0.875rem', color: '#334155' }}>
              <span style={styles.chip}>{rel.type}</span>
              <strong>{rel.targetEntity}</strong>
              <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>via {rel.field}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

const ModuleDetail: React.FC<{ module: Module }> = ({ module }) => (
  <div>
    <h2 style={styles.detailTitle}>{module.name}</h2>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>Root Path</div>
      <div style={styles.detailValue}>{module.rootPath}</div>
    </div>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>File Count</div>
      <div style={styles.detailValue}>{module.files.length} files</div>
    </div>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>Description</div>
      <div style={styles.detailValue}>{module.description || <span style={{ color: '#94a3b8' }}>No description</span>}</div>
    </div>

    <div style={styles.detailSection}>
      <div style={styles.detailLabel}>Dependencies</div>
      {module.dependencies.length === 0 ? (
        <div style={{ ...styles.detailValue, color: '#94a3b8' }}>None</div>
      ) : (
        <div>
          {module.dependencies.map((dep, idx) => (
            <span key={idx} style={styles.chip}>{dep}</span>
          ))}
        </div>
      )}
    </div>
  </div>
);

// --- Main ExplorerView ---

const ExplorerView: React.FC = () => {
  const { knowledgeBase } = useSession();
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string, type: EntityType) => {
    setSelected({ id, type });
  }, []);

  if (!knowledgeBase) {
    return (
      <div style={styles.emptyState}>
        <p>Loading project data...</p>
      </div>
    );
  }

  const { components, endpoints, entities, modules } = knowledgeBase;

  const renderDetailPanel = () => {
    if (!selected) {
      return (
        <div style={styles.emptyState}>
          <p>Select an item from the sidebar to view its details</p>
        </div>
      );
    }

    switch (selected.type) {
      case 'component': {
        const item = components.find((c) => c.id === selected.id);
        if (!item) return <div style={styles.emptyState}><p>Component not found</p></div>;
        return <ComponentDetail component={item} allComponents={components} onNavigate={handleSelect} />;
      }
      case 'endpoint': {
        const item = endpoints.find((e) => e.id === selected.id);
        if (!item) return <div style={styles.emptyState}><p>Endpoint not found</p></div>;
        return <EndpointDetail endpoint={item} />;
      }
      case 'entity': {
        const item = entities.find((e) => e.id === selected.id);
        if (!item) return <div style={styles.emptyState}><p>Entity not found</p></div>;
        return <EntityDetail entity={item} />;
      }
      case 'module': {
        const item = modules.find((m) => m.id === selected.id);
        if (!item) return <div style={styles.emptyState}><p>Module not found</p></div>;
        return <ModuleDetail module={item} />;
      }
      default:
        return null;
    }
  };

  const getItemStyle = (id: string, type: EntityType) => {
    const isActive = selected?.id === id && selected?.type === type;
    const isHovered = hoveredId === `${type}-${id}`;
    return {
      ...styles.listItem,
      ...(isActive ? styles.listItemActive : {}),
      ...(isHovered && !isActive ? styles.listItemHover : {}),
    };
  };

  return (
    <div style={styles.container}>
      {/* Left Sidebar */}
      <nav style={styles.sidebar} aria-label="Explorer navigation">
        <CollapsibleSection title="Frontend" count={components.length}>
          {components.length === 0 ? (
            <div style={{ padding: '0.4rem 1.5rem', fontSize: '0.8125rem', color: '#94a3b8' }}>No components</div>
          ) : (
            components.map((comp) => (
              <div
                key={comp.id}
                style={getItemStyle(comp.id, 'component')}
                onClick={() => handleSelect(comp.id, 'component')}
                onMouseEnter={() => setHoveredId(`component-${comp.id}`)}
                onMouseLeave={() => setHoveredId(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(comp.id, 'component'); }}
                title={comp.filePath}
              >
                {comp.name}
              </div>
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Backend" count={endpoints.length}>
          {endpoints.length === 0 ? (
            <div style={{ padding: '0.4rem 1.5rem', fontSize: '0.8125rem', color: '#94a3b8' }}>No endpoints</div>
          ) : (
            endpoints.map((ep) => (
              <div
                key={ep.id}
                style={getItemStyle(ep.id, 'endpoint')}
                onClick={() => handleSelect(ep.id, 'endpoint')}
                onMouseEnter={() => setHoveredId(`endpoint-${ep.id}`)}
                onMouseLeave={() => setHoveredId(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(ep.id, 'endpoint'); }}
                title={`${ep.method} ${ep.path}`}
              >
                <span style={{ ...styles.badge, backgroundColor: methodColors[ep.method] ?? '#6b7280', marginRight: '0.4rem', fontSize: '0.625rem', padding: '0.1rem 0.3rem' }}>
                  {ep.method}
                </span>
                {ep.path}
              </div>
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Database" count={entities.length}>
          {entities.length === 0 ? (
            <div style={{ padding: '0.4rem 1.5rem', fontSize: '0.8125rem', color: '#94a3b8' }}>No entities</div>
          ) : (
            entities.map((ent) => (
              <div
                key={ent.id}
                style={getItemStyle(ent.id, 'entity')}
                onClick={() => handleSelect(ent.id, 'entity')}
                onMouseEnter={() => setHoveredId(`entity-${ent.id}`)}
                onMouseLeave={() => setHoveredId(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(ent.id, 'entity'); }}
                title={ent.sourceFile}
              >
                {ent.name}
              </div>
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Architecture" count={modules.length}>
          {modules.length === 0 ? (
            <div style={{ padding: '0.4rem 1.5rem', fontSize: '0.8125rem', color: '#94a3b8' }}>No modules</div>
          ) : (
            modules.map((mod) => (
              <div
                key={mod.id}
                style={getItemStyle(mod.id, 'module')}
                onClick={() => handleSelect(mod.id, 'module')}
                onMouseEnter={() => setHoveredId(`module-${mod.id}`)}
                onMouseLeave={() => setHoveredId(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(mod.id, 'module'); }}
                title={mod.rootPath}
              >
                {mod.name}
              </div>
            ))
          )}
        </CollapsibleSection>
      </nav>

      {/* Right Detail Panel */}
      <main style={styles.detailPanel} aria-label="Entity detail view">
        {renderDetailPanel()}
      </main>
    </div>
  );
};

export default ExplorerView;
