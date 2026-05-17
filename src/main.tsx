import React from 'react';
import ReactDOM from 'react-dom/client';
import DashboardApp from './dashboard/DashboardApp';

// Simple main entry point for development
const container = document.getElementById('app');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<DashboardApp />);
}