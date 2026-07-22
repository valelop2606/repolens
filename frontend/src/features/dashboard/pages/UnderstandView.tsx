import React, { useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useSession } from '../../upload/context/SessionContext';
import type { Technology, Module, AnalysisWarning } from '../../../shared/types';

// --- Color helpers ---

const confidenceColors: Record<Technology['confidence'], string> = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#6b7280',
};

const severityColors: Record<AnalysisWarning['severity'], string> = {
  info: '#3b82f6',
  warning: '#f59e0b',
  error: '#ef4444',
};

// --- Sub-components ---

const ProjectHeader: React.FC<{ name: string; version: string; description: string }> = ({
  name,
  version,
  description,
}) => (
  <header style={{ marginBottom: '2rem' }}>
    <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#1e293b' }}>
      {name} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}>v{version}</span>
    </h1>
    {description && (
      <p style={{ marginTop: '0.5rem', color: '#475569', fontSize: '1rem', lineHeight: 1.5 }}>
        {description}
      </p>
    )}
  </header>
);

const TechStackBadges: React.FC<{ technologies: Technology[] }> = ({ technologies }) => (
  <section aria-labelledby="tech-stack-heading" style={{ marginBottom: '2rem' }}>
    <h2 id="tech-stack-heading" style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem' }}>
      Technology Stack
    </h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }} role="list" aria-label="Technologies">
      {technologies.map((tech) => (
        <span
          key={tech.name}
          role="listitem"
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: confidenceColors[tech.confidence],
            color: '#fff',
            fontSize: '0.8125rem',
            fontWeight: 500,
          }}
          title={`Confidence: ${tech.confidence} — Detected by: ${tech.detectedBy}`}
        >
          {tech.name}
        </span>
      ))}
    </div>
  </section>
);

const ModuleList: React.FC<{ modules: Module[] }> = ({ modules }) => (
  <section aria-labelledby="modules-heading" style={{ marginBottom: '2rem' }}>
    <h2 id="modules-heading" style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem' }}>
      Modules
    </h2>
    {modules.length === 0 ? (
      <p style={{ color: '#64748b' }}>No modules detected.</p>
    ) : (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {modules.map((mod) => (
          <li
            key={mod.id}
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '0.5rem',
              backgroundColor: '#f8fafc',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
            }}
          >
            <strong style={{ color: '#1e293b' }}>{mod.name}</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
              {mod.description}
            </p>
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

const DependencyGraphCanvas: React.FC<{ modules: Module[]; nodes: string[]; edges: { from: string; to: string; isCircular: boolean }[] }> = ({
  modules,
  nodes,
  edges,
}) => {
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
      <p style={{ color: '#64748b' }}>No dependency graph available.</p>
    );
  }

  return (
    <div
      style={{
        height: '400px',
        border: '1px solid #e2e8f0',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
      }}
      aria-label="Dependency graph visualization"
      role="img"
    >
      <ForceGraph2D
        graphData={graphData}
        nodeLabel={(node: GraphNode) => node.name}
        linkColor={(link: GraphLink) => (link.isCircular ? '#ef4444' : '#94a3b8')}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.name as string;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = '#334155';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Draw node circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#4a90d9';
          ctx.fill();

          // Draw label
          ctx.fillStyle = '#334155';
          ctx.fillText(label, node.x, node.y + 10);
        }}
        width={undefined}
        height={400}
      />
    </div>
  );
};

const WarningPanel: React.FC<{ warnings: AnalysisWarning[] }> = ({ warnings }) => {
  if (warnings.length === 0) return null;

  return (
    <section aria-labelledby="warnings-heading" style={{ marginBottom: '2rem' }}>
      <h2 id="warnings-heading" style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem' }}>
        Warnings
      </h2>
      <div
        role="alert"
        style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '0.5rem',
          padding: '1rem',
        }}
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {warnings.map((warning, idx) => (
            <li
              key={`${warning.code}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                marginBottom: idx < warnings.length - 1 ? '0.5rem' : 0,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: severityColors[warning.severity],
                  marginTop: '0.4rem',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <span style={{ fontSize: '0.875rem', color: '#1e293b' }}>
                <strong>[{warning.code}]</strong> {warning.message}
                {warning.file && (
                  <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>({warning.file})</span>
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>Loading project data...</p>
      </div>
    );
  }

  const { metadata, technologies, modules, dependencyGraph, warnings } = knowledgeBase;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <ProjectHeader name={metadata.name} version={metadata.version} description={metadata.description} />

      <TechStackBadges technologies={technologies} />

      <ModuleList modules={modules} />

      <section aria-labelledby="dependency-graph-heading" style={{ marginBottom: '2rem' }}>
        <h2
          id="dependency-graph-heading"
          style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem' }}
        >
          Dependency Graph
        </h2>
        <DependencyGraphCanvas
          modules={modules}
          nodes={dependencyGraph.nodes}
          edges={dependencyGraph.edges}
        />
      </section>

      <WarningPanel warnings={warnings} />
    </div>
  );
};

export default UnderstandView;
