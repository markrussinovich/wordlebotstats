// Simple content script for Wordle page
// This is a temporary minimal version to resolve the loading error

console.log('[Content] Wordle content script loaded');

// Check if we're on a Wordle page
if (window.location.href.includes('nytimes.com/games/wordle')) {
  console.log('[Content] On Wordle page, initializing...');
  
  // Basic content script functionality
  // This will be expanded once the module system is working
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] Received message:', message);
    
    if (message.type === 'GET_WORDLE_DATA') {
      // Basic game data extraction
      console.log('[Content] Extracting Wordle data...');
      sendResponse({ success: true, data: [] });
    }
    
    return true;
  });
}