import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject, uploadRepository } from '../services/api.client';

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

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <h1>Codebase Understanding Platform</h1>
      <p>Upload your repository to generate an interactive Knowledge Base.</p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="project-name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Project Name
          </label>
          <input
            id="project-name"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Enter project name"
            disabled={isUploading}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Drop zone for zip file upload"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              fileInputRef.current?.click();
            }
          }}
          style={{
            border: `2px dashed ${isDragging ? '#4a90d9' : '#ccc'}`,
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            backgroundColor: isDragging ? '#f0f7ff' : '#fafafa',
            marginBottom: '1rem',
            transition: 'border-color 0.2s, background-color 0.2s',
          }}
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
            <p style={{ margin: 0 }}>
              Selected: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          ) : (
            <p style={{ margin: 0, color: '#666' }}>
              Drag & drop a <strong>.zip</strong> file here, or click to browse
            </p>
          )}
        </div>

        {progress !== null && (
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: '#4a90d9',
                  transition: 'width 0.3s ease',
                }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
              {progress}% uploaded
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '4px',
              padding: '0.75rem',
              color: '#dc2626',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isUploading || !projectName.trim() || !file}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            backgroundColor: isUploading ? '#9ca3af' : '#4a90d9',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isUploading ? 'not-allowed' : 'pointer',
          }}
        >
          {isUploading ? 'Uploading...' : 'Upload & Analyze'}
        </button>
      </form>
    </div>
  );
};

export default UploadPage;
