// Dashboard entry point - renders the full dashboard application
import React from 'react';
import { createRoot } from 'react-dom/client';
import DashboardApp from './DashboardApp';

// Render the dashboard application
const container = document.getElementById('dashboard-root');
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(DashboardApp));
} else {
  console.error('[Dashboard] Could not find dashboard root element');
}