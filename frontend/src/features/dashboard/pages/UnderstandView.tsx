import React, { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useSession } from '../../upload/context/SessionContext';
import type { Technology, Module, AnalysisWarning } from '../../../shared/types';
import Icon, { type IconName } from '../../../shared/ui/Icon';

// --- Color helpers (canvas + dots need literal colors) ---

const confidenceColors: Record<Technology['confidence'], string> = {
  high: '#059669',
  medium: '#d97706',
  low: '#94a3b8',
};

const severityColors: Record<AnalysisWarning['severity'], string> = {
  info: '#4f46e5',
  warning: '#d97706',
  error: '#dc2626',
};

// --- Sub-components ---

const ProjectHeader: React.FC<{ name: string; version: string; description: string }> = ({
  name,
  version,
  description,
}) => (
  <header className="page-header">
    <div>
      <div className="eyebrow">Overview</div>
      <h1>
        {name}{' '}
        {version && (
          <span className="badge" style={{ verticalAlign: 'middle', marginLeft: 6, fontFamily: 'var(--mono)' }}>
            v{version}
          </span>
        )}
      </h1>
      {description && <p>{description}</p>}
    </div>
  </header>
);

const StatTiles: React.FC<{ items: { icon: IconName; label: string; value: number }[] }> = ({ items }) => (
  <div className="stat-grid">
    {items.map((s) => (
      <div key={s.label} className="card stat">
        <div className="stat-icon">
          <Icon name={s.icon} size={17} />
        </div>
        <div className="value">{s.value}</div>
        <div className="label-sm">{s.label}</div>
      </div>
    ))}
  </div>
);

const TechStackBadges: React.FC<{ technologies: Technology[] }> = ({ technologies }) => (
  <section aria-labelledby="tech-stack-heading" className="section">
    <h2 id="tech-stack-heading" className="section-title">
      Technology stack
      <span className="legend">
        <span><i style={{ background: confidenceColors.high, height: 6, width: 6, borderRadius: 6 }} />High</span>
        <span><i style={{ background: confidenceColors.medium, height: 6, width: 6, borderRadius: 6 }} />Medium</span>
        <span><i style={{ background: confidenceColors.low, height: 6, width: 6, borderRadius: 6 }} />Low</span>
      </span>
    </h2>
    {technologies.length === 0 ? (
      <p style={{ color: 'var(--muted)', margin: 0 }}>No technologies detected.</p>
    ) : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }} role="list" aria-label="Technologies">
        {technologies.map((tech) => (
          <span
            key={tech.name}
            role="listitem"
            className="badge"
            style={{ height: 28, padding: '0 0.75rem', fontSize: '0.8125rem' }}
            title={`Confidence: ${tech.confidence} — Detected by: ${tech.detectedBy}`}
          >
            <span className="dot" style={{ background: confidenceColors[tech.confidence] }} />
            {tech.name}
          </span>
        ))}
      </div>
    )}
  </section>
);

const ModuleList: React.FC<{ modules: Module[] }> = ({ modules }) => (
  <section aria-labelledby="modules-heading" className="section">
    <h2 id="modules-heading" className="section-title">
      Modules <span className="count">{modules.length}</span>
    </h2>
    {modules.length === 0 ? (
      <p style={{ color: 'var(--muted)', margin: 0 }}>No modules detected.</p>
    ) : (
      <ul className="grid-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {modules.map((mod) => (
          <li key={mod.id} className="card module-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <strong>{mod.name}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--subtle)', flexShrink: 0 }}>
                {mod.files.length} files
              </span>
            </div>
            {mod.rootPath && <div className="path">{mod.rootPath}</div>}
            {mod.description && <p>{mod.description}</p>}
          </li>
        ))}
      </ul>
    )}
  </section>
);

interface GraphNode {
  id: string;
  name: string;
}

interface GraphLink {
  source: string;
  target: string;
  isCircular: boolean;
}

const GRAPH_HEIGHT = 420;

const DependencyGraphCanvas: React.FC<{ modules: Module[]; nodes: string[]; edges: { from: string; to: string; isCircular: boolean }[] }> = ({
  modules,
  nodes,
  edges,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(undefined);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const graphNodes: GraphNode[] = nodes.map((nodeId) => {
      const mod = modules.find((m) => m.id === nodeId);
      return { id: nodeId, name: mod?.name ?? nodeId };
    });

    const graphLinks: GraphLink[] = edges.map((edge) => ({
      source: edge.from,
      target: edge.to,
      isCircular: edge.isCircular,
    }));

    return { nodes: graphNodes, links: graphLinks };
  }, [modules, nodes, edges]);

  if (nodes.length === 0) {
    return (
      <div className="card card-pad" style={{ color: 'var(--muted)', textAlign: 'center', padding: '2.5rem' }}>
        No dependency graph available.
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="card graph-card"
      style={{ height: GRAPH_HEIGHT }}
      aria-label="Dependency graph visualization"
      role="img"
    >
      {width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={width}
          cooldownTicks={80}
          onEngineStop={() => {
            const fg = fgRef.current;
            if (!fg) return;
            fg.zoomToFit(0, 80);
            if (fg.zoom() > 2.2) fg.zoom(2.2, 0);
          }}
          height={GRAPH_HEIGHT}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel={(node: GraphNode) => node.name}
          linkColor={(link: GraphLink) => (link.isCircular ? '#dc2626' : '#c3c9d6')}
          linkWidth={(link: GraphLink) => (link.isCircular ? 1.6 : 1)}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.name as string;
            const fontSize = 11 / globalScale;

            // Node: soft halo + solid core
            ctx.beginPath();
            ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(79, 70, 229, 0.14)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(node.x, node.y, 4.5, 0, 2 * Math.PI);
            ctx.fillStyle = '#4f46e5';
            ctx.fill();

            // Label
            ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#334155';
            ctx.fillText(label, node.x, node.y + 10);
          }}
        />
      )}
    </div>
  );
};

const WarningPanel: React.FC<{ warnings: AnalysisWarning[] }> = ({ warnings }) => {
  if (warnings.length === 0) return null;

  return (
    <section aria-labelledby="warnings-heading" className="section">
      <h2 id="warnings-heading" className="section-title">
        Analysis warnings <span className="count">{warnings.length}</span>
      </h2>
      <div role="alert" className="card" style={{ overflow: 'hidden' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {warnings.map((warning, idx) => (
            <li
              key={`${warning.code}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: severityColors[warning.severity],
                  marginTop: '0.4rem',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)', minWidth: 0 }}>
                <code style={{ color: 'var(--text)', fontWeight: 500 }}>{warning.code}</code>{' '}
                {warning.message}
                {warning.file && (
                  <span style={{ display: 'block', color: 'var(--subtle)', fontFamily: 'var(--mono)', fontSize: '0.75rem', marginTop: 2 }}>
                    {warning.file}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

// --- Main View ---

const UnderstandView: React.FC = () => {
  const { knowledgeBase } = useSession();

  if (!knowledgeBase) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 300, color: 'var(--muted)' }}>
        Loading project data…
      </div>
    );
  }

  const { metadata, technologies, modules, endpoints, components, entities, dependencyGraph, warnings } =
    knowledgeBase;
  const circular = dependencyGraph.edges.filter((e) => e.isCircular).length;

  return (
    <div className="page fade-in">
      <ProjectHeader name={metadata.name} version={metadata.version} description={metadata.description} />

      <StatTiles
        items={[
          { icon: 'box', label: 'Modules', value: modules.length },
          { icon: 'plug', label: 'API endpoints', value: endpoints.length },
          { icon: 'layers', label: 'UI components', value: components.length },
          { icon: 'db', label: 'Data entities', value: entities.length },
        ]}
      />

      <TechStackBadges technologies={technologies} />

      <section aria-labelledby="dependency-graph-heading" className="section">
        <h2 id="dependency-graph-heading" className="section-title">
          Dependency graph
          <span className="legend">
            <span><i style={{ background: '#c3c9d6' }} />Import</span>
            <span><i style={{ background: '#dc2626' }} />Circular{circular > 0 ? ` (${circular})` : ''}</span>
          </span>
        </h2>
        <DependencyGraphCanvas modules={modules} nodes={dependencyGraph.nodes} edges={dependencyGraph.edges} />
      </section>

      <ModuleList modules={modules} />

      <WarningPanel warnings={warnings} />
    </div>
  );
};

export default UnderstandView;
