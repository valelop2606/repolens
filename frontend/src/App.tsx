import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SessionProvider } from './features/upload/context/SessionContext';
import UploadPage from './features/upload/pages/UploadPage';
import SessionLayout from './features/upload/layouts/SessionLayout';
import UnderstandView from './features/dashboard/pages/UnderstandView';
import LearningJourneyView from './features/journey/pages/LearningJourneyView';
import ExplorerView from './features/explore/pages/ExplorerView';
import FeatureFlowView from './features/explore/pages/FeatureFlowView';

// Placeholder for nested session views — replaced in subsequent tasks
const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div>
    <h2>{title}</h2>
    <p>This view will be implemented in a future task.</p>
  </div>
);

const App: React.FC = () => {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/session/:id" element={<SessionLayout />}>
            <Route index element={<Navigate to="understand" replace />} />
            <Route path="understand" element={<UnderstandView />} />
            <Route path="journey" element={<LearningJourneyView />} />
            <Route path="explore" element={<ExplorerView />} />
            <Route path="feature-flow" element={<FeatureFlowView />} />
            <Route path="assistant" element={<Placeholder title="AI Assistant" />} />
            <Route path="docs" element={<Placeholder title="Docs" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
};

export default App;
