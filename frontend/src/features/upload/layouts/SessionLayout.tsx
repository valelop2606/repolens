import React, { useEffect, useState } from 'react';
import { Outlet, useParams, NavLink, Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { getSession } from '../services/api.client';
import Icon, { type IconName } from '../../../shared/ui/Icon';

const navItems: { to: string; label: string; icon: IconName }[] = [
  { to: 'understand', label: 'Overview', icon: 'compass' },
  { to: 'journey', label: 'Learning Journey', icon: 'route' },
  { to: 'explore', label: 'Explorer', icon: 'folder' },
  { to: 'feature-flow', label: 'Feature Flow', icon: 'flow' },
  { to: 'assistant', label: 'AI Assistant', icon: 'sparkles' },
  { to: 'docs', label: 'Docs', icon: 'doc' },
];

const Brand: React.FC = () => (
  <Link to="/" className="brand">
    <span className="brand-mark">
      <Icon name="logo" size={16} strokeWidth={2.2} />
    </span>
    Codebase Understanding
  </Link>
);

const SessionLayout: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { setSession, knowledgeBase } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No session ID provided.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchKB() {
      try {
        const kb = await getSession(id!);
        if (!cancelled) {
          setSession(id!, kb);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Session not found or failed to load.');
          setLoading(false);
        }
      }
    }

    fetchKB();

    return () => {
      cancelled = true;
    };
  }, [id, setSession]);

  if (loading) {
    return (
      <div className="shell">
        <aside className="sidebar">
          <Brand />
          <div className="skeleton" style={{ height: 52, opacity: 0.15 }} />
        </aside>
        <main className="main">
          <div className="page" aria-busy="true" aria-label="Loading session">
            <div className="skeleton" style={{ width: 120, height: 12, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: 280, height: 28, marginBottom: 28 }} />
            <div className="stat-grid">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 112, borderRadius: 14 }} />
              ))}
            </div>
            <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="center-screen">
        <div className="card card-pad fade-in" role="alert" style={{ maxWidth: 420, textAlign: 'center', padding: '2rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              margin: '0 auto 1rem',
              display: 'grid',
              placeItems: 'center',
              borderRadius: 12,
              background: 'var(--danger-soft)',
              color: 'var(--danger)',
            }}
          >
            <Icon name="alert" size={22} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>We couldn't open this session</h2>
          <p style={{ color: 'var(--muted)', margin: '0.5rem 0 1.5rem' }}>{error}</p>
          <Link to="/" className="btn btn-primary">
            <Icon name="upload" size={16} />
            Upload a repository
          </Link>
        </div>
      </div>
    );
  }

  const kb = knowledgeBase;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />

        <div className="project-chip">
          <div className="eyebrow" style={{ color: '#6b7591', marginBottom: 4 }}>Project</div>
          <div className="name" title={kb?.metadata.name}>{kb?.metadata.name || 'Project'}</div>
          {kb && (
            <div className="meta">
              {kb.modules.length} modules · {kb.endpoints.length} endpoints
            </div>
          )}
        </div>

        <nav className="nav" aria-label="Session sections">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/" className="nav-link">
            <Icon name="plus" size={16} />
            New analysis
          </Link>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
};

export default SessionLayout;
