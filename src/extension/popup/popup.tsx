// Entry point for popup
import React from 'react';
import ReactDOM from 'react-dom/client';
import PopupComponent from './PopupComponent';

console.log('[Popup] React entry point loading...');

const container = document.getElementById('popup-root');
if (container) {
  console.log('[Popup] Mounting React app...');
  
  // Clear the initial loading message before React renders
  container.innerHTML = '';
  
  const root = ReactDOM.createRoot(container);
  root.render(<PopupComponent />);
  
  console.log('[Popup] React app mounted successfully');
} else {
  console.error('[Popup] popup-root container not found!');
}