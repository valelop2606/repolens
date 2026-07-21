import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Placeholder pages — will be replaced in subsequent tasks
const UploadPage: React.FC = () => (
  <div>
    <h1>Codebase Understanding Platform</h1>
    <p>Upload page coming soon.</p>
  </div>
);

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
