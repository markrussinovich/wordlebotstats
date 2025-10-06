// Main dashboard application component
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import OverviewPage from './pages/OverviewPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import DataManagementPage from './pages/DataManagementPage';
import useDashboardData from './hooks/useDashboardData';

const DashboardApp: React.FC = () => {
  const { isLoading, error, initialized } = useDashboardData();

  // Show loading state while initializing
  if (!initialized && isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading Wordle Stat Explorer...</div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (error && !initialized) {
    return (
      <div className="dashboard-error">
        <h2>Failed to Load Dashboard</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <Router>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/data" element={<DataManagementPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Router>
  );
};

export default DashboardApp;