import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GameResult, StatisticsPeriod } from '@/types/gameTypes';
import { TimeFrame } from '@/types/benchmarkTypes';
import { 
  GetQuickStatsMessage, 
  QuickStatsResponse, 
  MessageType 
} from '@/types/messagingTypes';

interface GameDataState {
  // Game results data
  games: GameResult[];
  isLoading: boolean;
  lastUpdated: string | null;
  
  // Computed statistics
  currentStatistics: Record<TimeFrame, StatisticsPeriod | null>;
  
  // Actions
  addGame: (game: GameResult) => void;
  addGames: (games: GameResult[]) => void;
  updateGame: (gameId: string, updates: Partial<GameResult>) => void;
  removeGame: (gameId: string) => void;
  clearAllGames: () => void;
  
  // Statistics actions
  getStatisticsForTimeFrame: (timeFrame: TimeFrame) => StatisticsPeriod | null;
  refreshStatistics: (timeFrame: TimeFrame) => Promise<void>;
  
  // Utility actions
  setLoading: (loading: boolean) => void;
  getGameById: (gameId: string) => GameResult | undefined;
  getGamesByDateRange: (startDate: string, endDate: string) => GameResult[];
  
  // Extension integration
  loadDataFromExtension: () => Promise<void>;
  sendStatsRequest: (timeFrame: TimeFrame) => Promise<StatisticsPeriod | null>;
}

export const useGameDataStore = create<GameDataState>()(
  immer((set, get) => ({
    // Initial state
    games: [],
    isLoading: false,
    lastUpdated: null,
    currentStatistics: {
      '7d': null,
      '30d': null,
      '90d': null,
      'ytd': null,
      'all': null
    },

    // Game management actions
    addGame: (game: GameResult) => set((state) => {
      // Check for duplicates
      const existingIndex = state.games.findIndex(g => g.gameId === game.gameId);
      if (existingIndex >= 0) {
        // Update existing game
        state.games[existingIndex] = game;
      } else {
        // Add new game, maintain chronological order
        state.games.push(game);
        state.games.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      state.lastUpdated = new Date().toISOString();
      
      // Invalidate statistics cache
      Object.keys(state.currentStatistics).forEach(timeFrame => {
        state.currentStatistics[timeFrame as TimeFrame] = null;
      });
    }),

    addGames: (games: GameResult[]) => set((state) => {
      // Merge games, avoiding duplicates
      const existingIds = new Set(state.games.map(g => g.gameId));
      const newGames = games.filter(g => !existingIds.has(g.gameId));
      
      state.games.push(...newGames);
      state.games.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      state.lastUpdated = new Date().toISOString();
      
      // Invalidate statistics cache
      Object.keys(state.currentStatistics).forEach(timeFrame => {
        state.currentStatistics[timeFrame as TimeFrame] = null;
      });
    }),

    updateGame: (gameId: string, updates: Partial<GameResult>) => set((state) => {
      const gameIndex = state.games.findIndex(g => g.gameId === gameId);
      if (gameIndex >= 0) {
        state.games[gameIndex] = { ...state.games[gameIndex], ...updates };
        state.lastUpdated = new Date().toISOString();
        
        // Invalidate statistics cache
        Object.keys(state.currentStatistics).forEach(timeFrame => {
          state.currentStatistics[timeFrame as TimeFrame] = null;
        });
      }
    }),

    removeGame: (gameId: string) => set((state) => {
      const gameIndex = state.games.findIndex(g => g.gameId === gameId);
      if (gameIndex >= 0) {
        state.games.splice(gameIndex, 1);
        state.lastUpdated = new Date().toISOString();
        
        // Invalidate statistics cache
        Object.keys(state.currentStatistics).forEach(timeFrame => {
          state.currentStatistics[timeFrame as TimeFrame] = null;
        });
      }
    }),

    clearAllGames: () => set((state) => {
      state.games = [];
      state.lastUpdated = new Date().toISOString();
      
      // Clear statistics cache
      Object.keys(state.currentStatistics).forEach(timeFrame => {
        state.currentStatistics[timeFrame as TimeFrame] = null;
      });
    }),

    // Statistics actions
    getStatisticsForTimeFrame: (timeFrame: TimeFrame) => {
      const state = get();
      
      // Return cached statistics if available
      if (state.currentStatistics[timeFrame]) {
        return state.currentStatistics[timeFrame];
      }
      
      // Calculate statistics for the time frame
      const now = new Date();
      let startDate: Date;
      
      switch (timeFrame) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'ytd':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'all':
          startDate = new Date(0); // Beginning of time
          break;
        default:
          startDate = new Date(0);
      }
      
      const filteredGames = state.games.filter(game => 
        new Date(game.date) >= startDate && new Date(game.date) <= now
      );
      
      if (filteredGames.length === 0) {
        return null;
      }
      
      const statistics = calculateStatisticsFromGames(filteredGames, timeFrame, startDate, now);
      
      // Cache the calculated statistics
      set((state) => {
        state.currentStatistics[timeFrame] = statistics;
      });
      
      return statistics;
    },

    refreshStatistics: async (timeFrame: TimeFrame) => {
      set((state) => {
        state.currentStatistics[timeFrame] = null;
      });
      get().getStatisticsForTimeFrame(timeFrame);
    },

    // Utility actions
    setLoading: (loading: boolean) => set((state) => {
      state.isLoading = loading;
    }),

    getGameById: (gameId: string) => {
      const state = get();
      return state.games.find(g => g.gameId === gameId);
    },

    getGamesByDateRange: (startDate: string, endDate: string) => {
      const state = get();
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      return state.games.filter(game => {
        const gameDate = new Date(game.date);
        return gameDate >= start && gameDate <= end;
      });
    },

    // Extension integration methods
    loadDataFromExtension: async () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          set((state) => {
            state.isLoading = true;
          });

          const response = await chrome.runtime.sendMessage({
            type: MessageType.GET_DASHBOARD_DATA
          });

          if (response && response.games) {
            set((state) => {
              state.games = response.games;
              state.lastUpdated = new Date().toISOString();
              state.isLoading = false;
              // Clear cached statistics to force recalculation
              Object.keys(state.currentStatistics).forEach(key => {
                state.currentStatistics[key as TimeFrame] = null;
              });
            });
          }
        } catch (error) {
          console.error('[GameDataStore] Failed to load data from extension:', error);
          set((state) => {
            state.isLoading = false;
          });
        }
      }
    },

    sendStatsRequest: async (timeFrame: TimeFrame) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          const message: GetQuickStatsMessage = {
            type: MessageType.GET_QUICK_STATS,
            timeFrame,
            includeBenchmarks: false
          };

          const response: QuickStatsResponse = await chrome.runtime.sendMessage(message);
          
          if (response.success && response.statistics) {
            // Convert background statistics to StatisticsPeriod format
            const statisticsPeriod: StatisticsPeriod = {
              startDate: '',
              endDate: new Date().toISOString(),
              gameCount: response.statistics.gameCount,
              winCount: Math.round((response.statistics.winRate / 100) * response.statistics.gameCount),
              winRate: response.statistics.winRate,
              averageGuesses: response.statistics.averageGuesses,
              currentStreak: response.statistics.currentStreak,
              maxStreak: response.statistics.maxStreak,
              guessDistribution: response.statistics.guessDistribution || [0, 0, 0, 0, 0, 0, 0],
              medianGuesses: response.statistics.averageGuesses || 0,
              perfectGames: response.statistics.guessDistribution?.[0] || 0,
              lastGuessWins: response.statistics.guessDistribution?.[5] || 0
            };

            // Cache the result
            set((state) => {
              state.currentStatistics[timeFrame] = statisticsPeriod;
            });

            return statisticsPeriod;
          }
        } catch (error) {
          console.error('[GameDataStore] Failed to get stats from extension:', error);
        }
      }

      // Fallback to local calculation
      return get().getStatisticsForTimeFrame(timeFrame);
    }
  }))
);

// Helper function to calculate statistics from games
function calculateStatisticsFromGames(
  games: GameResult[], 
  timeFrame: TimeFrame, 
  startDate: Date, 
  endDate: Date
): StatisticsPeriod {
  const gameCount = games.length;
  const completedGames = games.filter(g => g.completed);
  const wonGames = completedGames.filter(g => g.won);
  const failedGames = completedGames.filter(g => !g.won);
  
  const winCount = wonGames.length;
  const winRate = gameCount > 0 ? (winCount / gameCount) * 100 : 0;
  const failRate = gameCount > 0 ? (failedGames.length / gameCount) * 100 : 0;
  
  // Calculate average guesses (only for won games)
  const totalAttempts = wonGames.reduce((sum, game) => sum + (game.attempts || 0), 0);
  const averageGuesses = winCount > 0 ? totalAttempts / winCount : 0;
  
  // Calculate guess distribution [1,2,3,4,5,6,fail]
  const guessDistribution = [0, 0, 0, 0, 0, 0, 0];
  wonGames.forEach(game => {
    if (game.attempts && game.attempts >= 1 && game.attempts <= 6) {
      guessDistribution[game.attempts - 1]++;
    }
  });
  guessDistribution[6] = failedGames.length; // Failed games
  
  // Calculate streak information
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  
  // Calculate streaks from most recent games
  const sortedGames = [...games].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  for (let i = 0; i < sortedGames.length; i++) {
    if (sortedGames[i].won && sortedGames[i].streakActive) {
      tempStreak++;
      if (i === 0) currentStreak = tempStreak; // Current streak from most recent
    } else {
      maxStreak = Math.max(maxStreak, tempStreak);
      tempStreak = 0;
    }
  }
  maxStreak = Math.max(maxStreak, tempStreak);
  
  // Calculate other metrics
  const hardModeGames = games.filter(g => g.hardMode).length;
  const attempts = wonGames.map(g => g.attempts || 0).sort((a, b) => a - b);
  const medianGuesses = attempts.length > 0 
    ? attempts.length % 2 === 0 
      ? (attempts[attempts.length / 2 - 1] + attempts[attempts.length / 2]) / 2
      : attempts[Math.floor(attempts.length / 2)]
    : 0;
  
  const perfectGames = guessDistribution[0]; // 1-guess wins
  const lastGuessWins = guessDistribution[5]; // 6-guess wins
  
  return {
    periodId: `${timeFrame}-${startDate.toISOString()}-${endDate.toISOString()}`,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    gameCount,
    winCount,
    winRate,
    averageGuesses,
    guessDistribution,
    currentStreak,
    maxStreak,
    failRate,
    hardModeGames,
    totalAttempts,
    medianGuesses,
    perfectGames,
    lastGuessWins
  };
}