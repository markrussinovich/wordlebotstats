import React from 'react';
import ReactDOM from 'react-dom/client';
import PopupComponent from './extension/popup/PopupComponent';

// Simple main entry point for development
const container = document.getElementById('app');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<PopupComponent />);
}