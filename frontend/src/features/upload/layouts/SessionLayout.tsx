import React, { useEffect, useState } from 'react';
import { Outlet, useParams, NavLink } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { getSession } from '../services/api.client';

const navItems = [
  { to: 'understand', label: 'Understand' },
  { to: 'journey', label: 'Learning Journey' },
  { to: 'explore', label: 'Explorer' },
  { to: 'feature-flow', label: 'Feature Flow' },
  { to: 'assistant', label: 'AI Assistant' },
  { to: 'docs', label: 'Docs' },
];

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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div role="alert" style={{ color: '#dc2626', textAlign: 'center' }}>
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: '220px',
          backgroundColor: '#1e293b',
          color: '#f1f5f9',
          padding: '1rem 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '0 1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', margin: 0, color: '#94a3b8' }}>
            {knowledgeBase?.metadata.name || 'Project'}
          </h2>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'block',
                padding: '0.625rem 1rem',
                color: isActive ? '#fff' : '#94a3b8',
                backgroundColor: isActive ? '#334155' : 'transparent',
                textDecoration: 'none',
                fontSize: '0.875rem',
                borderLeft: isActive ? '3px solid #4a90d9' : '3px solid transparent',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default SessionLayout;
