import React from 'react';
import { createRoot } from 'react-dom/client';
import GamePlay from './GamePlay';

const container = document.getElementById('play-root');
const params = new URLSearchParams(window.location.search);
if (params.get('popout') === '1' && params.get('controls') !== '1')
  window.location.replace(chrome.runtime.getURL('popup.html') + '?popout=1');
else if (container) createRoot(container).render(<GamePlay />);
