// Content script for Wordle page integration
// Detects game completion and extracts game results

import { GameResult } from '@/types/gameTypes';
import { ImportGameResultMessage, MessageType } from '@/types/messagingTypes';

// Wordle game state detection
interface WordleGameState {
  isComplete: boolean;
  isWon: boolean;
  guesses: number;
  maxGuesses: number;
  solution?: string;
  date: string;
  gameNumber?: number;
}

class WordleIntegration {
  private observer: MutationObserver | null = null;
  private isInitialized = false;
  private lastProcessedDate: string | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[WordleContent] Initializing Wordle integration...');

    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupIntegration());
    } else {
      this.setupIntegration();
    }

    this.isInitialized = true;
  }

  private setupIntegration(): void {
    // Check if we're on the Wordle page
    if (!this.isWordlePage()) {
      console.log('[WordleContent] Not on Wordle page, integration disabled');
      return;
    }

    console.log('[WordleContent] Setting up Wordle page integration');

    // Monitor for game completion
    this.startGameMonitoring();

    // Check for existing completed game
    this.checkExistingGame();
  }

  private isWordlePage(): boolean {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    // Official Wordle sites
    return (
      hostname === 'www.nytimes.com' && pathname.includes('/games/wordle') ||
      hostname === 'www.powerlanguage.co.uk' && pathname.includes('/wordle') ||
      hostname.includes('wordle')
    );
  }

  private startGameMonitoring(): void {
    // Monitor DOM changes for game completion
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          this.checkForGameCompletion();
        }
      });
    });

    // Start observing the game container
    const gameContainer = document.querySelector('[data-testid="App-module_gameContainer"]') ||
                         document.querySelector('#wordle-app-game') ||
                         document.querySelector('.Game-module_game');

    if (gameContainer) {
      this.observer.observe(gameContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-state', 'aria-label']
      });
    } else {
      // Fallback: monitor entire document body
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    console.log('[WordleContent] Game monitoring started');
  }

  private checkExistingGame(): void {
    // Check if there's already a completed game on page load
    setTimeout(() => {
      this.checkForGameCompletion();
    }, 1000);
  }

  private async checkForGameCompletion(): Promise<void> {
    try {
      const gameState = this.detectGameState();
      
      if (gameState && gameState.isComplete) {
        // Avoid processing the same game multiple times
        if (this.lastProcessedDate === gameState.date) {
          return;
        }

        console.log('[WordleContent] Game completed detected:', gameState);
        
        const gameResult = this.convertToGameResult(gameState);
        await this.sendGameResult(gameResult);
        
        this.lastProcessedDate = gameState.date;
      }
    } catch (error) {
      console.error('[WordleContent] Error checking game completion:', error);
    }
  }

  private detectGameState(): WordleGameState | null {
    try {
      // Method 1: Check for completion modal/toast
      const completionModal = document.querySelector('[data-testid="toast"]') ||
                             document.querySelector('.Toast-module_toast') ||
                             document.querySelector('.game-modal');

      // Method 2: Check game board state
      const gameBoard = this.getGameBoard();
      if (!gameBoard) return null;

      const rows = gameBoard.querySelectorAll('[data-testid^="row"]') ||
                  gameBoard.querySelectorAll('.Row-module_row') ||
                  gameBoard.querySelectorAll('div[role="grid"] > div');

      if (rows.length === 0) return null;

      // Analyze the game state
      let guesses = 0;
      let isComplete = false;
      let isWon = false;

      Array.from(rows).forEach((row, index) => {
        const tiles = row.querySelectorAll('[data-testid^="tile"]') ||
                     row.querySelectorAll('.Tile-module_tile') ||
                     row.querySelectorAll('div[data-state]');

        if (tiles.length === 0) return;

        const rowHasContent = Array.from(tiles).some(tile => {
          const letter = tile.textContent?.trim();
          return letter && letter.length > 0;
        });

        if (rowHasContent) {
          guesses++;

          // Check if this row is complete (all tiles have states)
          const allTilesComplete = Array.from(tiles).every(tile => {
            const state = tile.getAttribute('data-state') ||
                         tile.getAttribute('aria-label') ||
                         this.getTileStateFromClass(tile as HTMLElement);
            return state && (state.includes('correct') || 
                           state.includes('present') || 
                           state.includes('absent') ||
                           state === 'correct' || 
                           state === 'present' || 
                           state === 'absent');
          });

          if (allTilesComplete) {
            // Check if this row is all correct (won)
            const allCorrect = Array.from(tiles).every(tile => {
              const state = tile.getAttribute('data-state') ||
                           this.getTileStateFromClass(tile as HTMLElement);
              return state === 'correct' || state?.includes('correct');
            });

            if (allCorrect) {
              isComplete = true;
              isWon = true;
              return;
            }

            // Check if this is the last row (lost)
            if (index === rows.length - 1) {
              isComplete = true;
              isWon = false;
            }
          }
        }
      });

      // Additional completion checks
      if (!isComplete) {
        // Check for completion indicators in the UI
        const shareButton = document.querySelector('[data-testid="share-button"]') ||
                           document.querySelector('button[aria-label*="Share"]') ||
                           document.querySelector('.ShareButton');

        if (shareButton || (completionModal && completionModal.textContent)) {
          isComplete = true;
          
          // Try to determine win/loss from modal text
          const modalText = completionModal?.textContent?.toLowerCase() || '';
          if (modalText.includes('congratulations') || modalText.includes('genius') || 
              modalText.includes('magnificent') || modalText.includes('impressive') ||
              modalText.includes('splendid') || modalText.includes('great') ||
              modalText.includes('phew')) {
            isWon = true;
          }
        }
      }

      if (!isComplete) return null;

      return {
        isComplete,
        isWon,
        guesses: isWon ? guesses : 0, // Only count guesses if won
        maxGuesses: rows.length,
        date: this.getCurrentGameDate(),
        gameNumber: this.getGameNumber()
      };

    } catch (error) {
      console.error('[WordleContent] Error detecting game state:', error);
      return null;
    }
  }

  private getGameBoard(): Element | null {
    return document.querySelector('[data-testid="board"]') ||
           document.querySelector('.Board-module_board') ||
           document.querySelector('#board') ||
           document.querySelector('div[role="grid"]') ||
           document.querySelector('.game-board');
  }

  private getTileStateFromClass(tile: HTMLElement): string | null {
    const classList = Array.from(tile.classList);
    
    if (classList.some(cls => cls.includes('correct') || cls.includes('green'))) {
      return 'correct';
    }
    if (classList.some(cls => cls.includes('present') || cls.includes('yellow'))) {
      return 'present';
    }
    if (classList.some(cls => cls.includes('absent') || cls.includes('gray') || cls.includes('grey'))) {
      return 'absent';
    }
    
    return null;
  }

  private getCurrentGameDate(): string {
    // Try to get date from URL or page
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private getGameNumber(): number | undefined {
    // Try to extract game number from the page
    const titleElement = document.querySelector('h1') || document.querySelector('title');
    const titleText = titleElement?.textContent || document.title;
    
    const match = titleText.match(/wordle\s*#?(\d+)/i);
    return match ? parseInt(match[1], 10) : undefined;
  }

  private convertToGameResult(gameState: WordleGameState): GameResult {
    const now = new Date();
    
    return {
      gameId: `${gameState.date}-${gameState.gameNumber || 'unknown'}`,
      date: gameState.date,
      won: gameState.isWon,
      attempts: gameState.guesses,
      guesses: gameState.guesses,
      maxGuesses: gameState.maxGuesses,
      duration: 0, // We can't reliably measure duration from the page
      wordLength: 5, // Wordle is always 5 letters
      gameNumber: gameState.gameNumber,
      source: 'wordle-page',
      importedAt: now.toISOString(),
      guessDistribution: [], // Could be enhanced to extract actual guesses
      hardMode: false // Could be detected from game settings
    };
  }

  private async sendGameResult(gameResult: GameResult): Promise<void> {
    try {
      const message: ImportGameResultMessage = {
        type: MessageType.IMPORT_GAME_RESULT,
        gameResult: gameResult,
        source: 'content-script',
        timestamp: Date.now()
      };

      // Send to background script
      const response = await chrome.runtime.sendMessage(message);
      
      if (response?.success) {
        console.log('[WordleContent] Game result sent successfully:', gameResult);
        this.showImportNotification(gameResult);
      } else {
        console.error('[WordleContent] Failed to send game result:', response?.error);
      }
    } catch (error) {
      console.error('[WordleContent] Error sending game result:', error);
    }
  }

  private showImportNotification(gameResult: GameResult): void {
    // Show a subtle notification that the game was imported
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #6aaa64;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 300px;
    `;
    
    const resultText = gameResult.won 
      ? `Wordle solved in ${gameResult.guesses}! 🎉`
      : 'Wordle attempt recorded 📊';
      
    notification.textContent = `${resultText} Stats updated.`;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isInitialized = false;
  }
}

// Initialize the Wordle integration
const wordleIntegration = new WordleIntegration();

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
  wordleIntegration.destroy();
});

// Export for potential testing
if (typeof window !== 'undefined') {
  (window as any).__wordleIntegration = wordleIntegration;
}