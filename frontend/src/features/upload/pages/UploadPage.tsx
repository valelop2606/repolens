import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject, uploadRepository } from '../services/api.client';
import Icon, { type IconName } from '../../../shared/ui/Icon';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.zip')) {
      setFile(droppedFile);
    } else {
      setError('Only .zip files are accepted.');
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const selectedFile = e.target.files?.[0];
      if (selectedFile && selectedFile.name.endsWith('.zip')) {
        setFile(selectedFile);
      } else if (selectedFile) {
        setError('Only .zip files are accepted.');
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!projectName.trim()) {
        setError('Project name is required.');
        return;
      }
      if (!file) {
        setError('Please select a .zip file to upload.');
        return;
      }

      setIsUploading(true);
      setProgress(0);

      try {
        const project = await createProject(projectName.trim(), '');
        const result = await uploadRepository(project.id, file, (percent) => {
          setProgress(percent);
        });

        localStorage.setItem('sessionId', result.sessionId);
        navigate(`/session/${result.sessionId}/understand`);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred during upload.');
        }
      } finally {
        setIsUploading(false);
      }
    },
    [projectName, file, navigate],
  );

  const features: { icon: IconName; title: string; text: string }[] = [
    { icon: 'graph', title: 'Architecture map', text: 'Modules, dependencies and circular imports at a glance.' },
    { icon: 'route', title: 'Guided learning', text: 'A step-by-step path through the codebase.' },
    { icon: 'sparkles', title: 'AI assistant', text: 'Ask questions with answers cited to real code.' },
  ];

  return (
    <div className="upload-page">
      <header className="upload-nav">
        <span className="brand" style={{ color: 'var(--text)' }}>
          <span className="brand-mark">
            <Icon name="logo" size={16} strokeWidth={2.2} />
          </span>
          Codebase Understanding
        </span>
      </header>

      <div className="upload-hero fade-in">
        <span className="badge" style={{ marginBottom: '1.25rem' }}>
          <span className="dot" style={{ background: 'var(--accent)' }} />
          Static analysis + AI
        </span>
        <h1>Understand any codebase in minutes</h1>
        <p className="lead">
          Upload a repository and get an interactive knowledge base: architecture, feature flows,
          a learning path, and an assistant that knows the code.
        </p>

        <form onSubmit={handleSubmit} className="card upload-card" noValidate>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="project-name" className="label">
              Project name
            </label>
            <input
              id="project-name"
              type="text"
              className="input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. payments-service"
              disabled={isUploading}
              autoComplete="off"
            />
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Drop zone for zip file upload"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
            className={`dropzone${isDragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`}
            aria-disabled={isUploading}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              disabled={isUploading}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            {file ? (
              <div className="file-chip">
                <span className="file-icon">
                  <Icon name="file" size={18} />
                </span>
                <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB · ready to analyze</span>
                </span>
                {!isUploading && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ height: 30, padding: '0 0.5rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    aria-label="Remove file"
                  >
                    <Icon name="x" size={16} />
                  </button>
                )}
              </div>
            ) : (
              <>
                <span className="drop-icon">
                  <Icon name="upload" size={20} />
                </span>
                <p style={{ margin: 0, fontWeight: 550 }}>
                  Drop your <code>.zip</code> here or <span style={{ color: 'var(--accent)' }}>browse</span>
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  Zip the repository root. node_modules is not needed.
                </p>
              </>
            )}
          </div>

          {progress !== null && (
            <div style={{ marginBottom: '1rem' }}>
              <div className="progress-track">
                <div
                  className="progress-bar"
                  style={{ transform: `scaleX(${progress / 100})` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <div className="progress-meta">
                <span>{progress < 100 ? 'Uploading' : 'Analyzing repository…'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="alert alert-danger" style={{ marginBottom: '1rem' }}>
              <Icon name="alert" size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block"
            disabled={isUploading || !projectName.trim() || !file}
          >
            {isUploading ? (
              <>
                <span className="spinner" />
                Uploading…
              </>
            ) : (
              <>
                Upload & analyze
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>

        <ul className="feature-row">
          {features.map((f) => (
            <li key={f.title}>
              <span className="feature-icon">
                <Icon name={f.icon} size={17} />
              </span>
              <div>
                <strong>{f.title}</strong>
                <p>{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UploadPage;
