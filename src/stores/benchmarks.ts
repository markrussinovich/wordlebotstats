// Benchmarks Zustand store for managing benchmark data and comparisons
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { BenchmarkData, BenchmarkSource } from '@/types/benchmarkTypes';
import { StatisticsPeriod, ComparisonResult } from '@/types/gameTypes';
import BenchmarkDataModel from '@/models/BenchmarkData';

interface BenchmarksState {
  // Data
  benchmarks: Record<BenchmarkSource, BenchmarkData | null>;
  comparisons: ComparisonResult[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  
  // Configuration
  enabledSources: BenchmarkSource[];
  autoUpdate: boolean;
  updateInterval: number; // minutes
}

interface BenchmarksActions {
  // Data management
  setBenchmark: (source: BenchmarkSource, data: BenchmarkData) => void;
  removeBenchmark: (source: BenchmarkSource) => void;
  clearBenchmarks: () => void;
  
  // Comparison operations
  compareUserStats: (userStats: StatisticsPeriod) => ComparisonResult[];
  addComparison: (comparison: ComparisonResult) => void;
  clearComparisons: () => void;
  
  // Data fetching
  fetchBenchmarks: (sources?: BenchmarkSource[]) => Promise<void>;
  updateBenchmark: (source: BenchmarkSource) => Promise<void>;
  
  // Configuration
  toggleSource: (source: BenchmarkSource) => void;
  setAutoUpdate: (enabled: boolean) => void;
  setUpdateInterval: (minutes: number) => void;
  
  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Utilities
  getBenchmark: (source: BenchmarkSource) => BenchmarkData | null;
  getAvailableBenchmarks: () => BenchmarkData[];
  getBenchmarkModel: (source: BenchmarkSource) => BenchmarkDataModel | null;
  isSourceEnabled: (source: BenchmarkSource) => boolean;
  needsUpdate: (source: BenchmarkSource) => boolean;
}

type BenchmarksStore = BenchmarksState & BenchmarksActions;

// Default benchmark data (fallback values)
const DEFAULT_NATIONAL_BENCHMARK: BenchmarkData = {
  source: 'national',
  winRate: 98.0,
  averageGuesses: 3.9,
  guessDistribution: [1, 4, 17, 33, 28, 15, 2],
  lastUpdated: '2024-01-01T00:00:00.000Z',
  sampleSize: 1000000,
  coverage: 95
};

const DEFAULT_WORDLEBOT_BENCHMARK: BenchmarkData = {
  source: 'wordlebot',
  winRate: 99.5,
  averageGuesses: 3.4,
  guessDistribution: [0, 2, 15, 42, 32, 9, 0],
  lastUpdated: '2024-01-01T00:00:00.000Z',
  sampleSize: 0,
  coverage: 100
};

export const useBenchmarksStore = create<BenchmarksStore>()(
  immer((set, get) => ({
    // Initial state
    benchmarks: {
      'national': DEFAULT_NATIONAL_BENCHMARK,
      'wordlebot': DEFAULT_WORDLEBOT_BENCHMARK
    },
    comparisons: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    enabledSources: ['national', 'wordlebot'],
    autoUpdate: true,
    updateInterval: 60, // 1 hour

    // Data management actions
    setBenchmark: (source, data) => set(state => {
      state.benchmarks[source] = data;
      state.lastUpdated = new Date().toISOString();
      state.error = null;
    }),

    removeBenchmark: (source) => set(state => {
      state.benchmarks[source] = null;
      // Remove related comparisons
      state.comparisons = state.comparisons.filter(
        comp => comp.benchmarkSource !== source
      );
    }),

    clearBenchmarks: () => set(state => {
      state.benchmarks = {
        'national': null,
        'wordlebot': null
      };
      state.comparisons = [];
    }),

    // Comparison operations
    compareUserStats: (userStats) => {
      const state = get();
      const comparisons: ComparisonResult[] = [];

      for (const source of state.enabledSources) {
        const benchmark = state.benchmarks[source];
        if (benchmark) {
          try {
            const benchmarkModel = new BenchmarkDataModel(benchmark);
            const comparison = benchmarkModel.compareToUserStats(userStats);
            comparisons.push(comparison);
          } catch (error) {
            console.error(`Failed to compare with ${source}:`, error);
          }
        }
      }

      set(state => {
        state.comparisons = comparisons;
      });

      return comparisons;
    },

    addComparison: (comparison) => set(state => {
      // Remove existing comparison for the same source
      state.comparisons = state.comparisons.filter(
        comp => comp.benchmarkSource !== comparison.benchmarkSource
      );
      state.comparisons.push(comparison);
    }),

    clearComparisons: () => set(state => {
      state.comparisons = [];
    }),

    // Data fetching
    fetchBenchmarks: async (sources) => {
      const state = get();
      const sourcesToFetch = sources || state.enabledSources;

      set(draft => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const fetchPromises = sourcesToFetch.map(source => 
          get().updateBenchmark(source)
        );

        await Promise.all(fetchPromises);

        set(draft => {
          draft.isLoading = false;
          draft.lastUpdated = new Date().toISOString();
        });

      } catch (error) {
        set(draft => {
          draft.isLoading = false;
          draft.error = error instanceof Error ? error.message : 'Failed to fetch benchmarks';
        });
        throw error;
      }
    },

    updateBenchmark: async (source) => {
      try {
        const benchmarkData = await fetchBenchmarkData(source);
        get().setBenchmark(source, benchmarkData);
      } catch (error) {
        console.error(`Failed to update benchmark ${source}:`, error);
        throw error;
      }
    },

    // Configuration
    toggleSource: (source) => set(state => {
      if (state.enabledSources.includes(source)) {
        state.enabledSources = state.enabledSources.filter(s => s !== source);
      } else {
        state.enabledSources.push(source);
      }
    }),

    setAutoUpdate: (enabled) => set(state => {
      state.autoUpdate = enabled;
    }),

    setUpdateInterval: (minutes) => set(state => {
      state.updateInterval = Math.max(15, minutes); // Minimum 15 minutes
    }),

    // State management
    setLoading: (loading) => set(state => {
      state.isLoading = loading;
    }),

    setError: (error) => set(state => {
      state.error = error;
    }),

    // Utilities
    getBenchmark: (source) => {
      return get().benchmarks[source];
    },

    getAvailableBenchmarks: () => {
      const state = get();
      return Object.values(state.benchmarks).filter(
        (benchmark): benchmark is BenchmarkData => 
          benchmark !== null && state.enabledSources.includes(benchmark.source)
      );
    },

    getBenchmarkModel: (source) => {
      const benchmark = get().benchmarks[source];
      return benchmark ? new BenchmarkDataModel(benchmark) : null;
    },

    isSourceEnabled: (source) => {
      return get().enabledSources.includes(source);
    },

    needsUpdate: (source) => {
      const state = get();
      const benchmark = state.benchmarks[source];
      
      if (!benchmark) return true;
      
      const lastUpdate = new Date(benchmark.lastUpdated);
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      return hoursSinceUpdate >= (state.updateInterval / 60);
    }
  }))
);

// Benchmark data fetching functions
async function fetchBenchmarkData(source: BenchmarkSource): Promise<BenchmarkData> {
  switch (source) {
    case 'national':
      return fetchNationalAverageBenchmark();
    case 'wordlebot':
      return fetchWordleBotBenchmark();
    default:
      throw new Error(`Unknown benchmark source: ${source}`);
  }
}

async function fetchNationalAverageBenchmark(): Promise<BenchmarkData> {
  // In a real implementation, this would fetch from an API
  // For now, return updated default data with current timestamp
  
  return {
    source: 'national',
    winRate: 98.1, // Slightly updated values
    averageGuesses: 3.85,
    guessDistribution: [1, 5, 17, 32, 29, 14, 2],
    lastUpdated: new Date().toISOString(),
    sampleSize: 1250000,
    coverage: 95
  };
}

async function fetchWordleBotBenchmark(): Promise<BenchmarkData> {
  // In a real implementation, this would scrape or call WordleBot API
  // For now, return updated default data
  
  return {
    source: 'wordlebot',
    winRate: 99.6,
    averageGuesses: 3.42,
    guessDistribution: [0, 2, 16, 41, 33, 8, 0],
    lastUpdated: new Date().toISOString(),
    sampleSize: 0,
    coverage: 100
  };
}

// Auto-update hook
let autoUpdateInterval: ReturnType<typeof setInterval> | null = null;

export const startBenchmarkAutoUpdate = () => {
  const { autoUpdate, updateInterval } = useBenchmarksStore.getState();
  
  if (!autoUpdate) return;
  
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
  }
  
  autoUpdateInterval = setInterval(async () => {
    const state = useBenchmarksStore.getState();
    if (!state.autoUpdate) return;
    
    const sourcesToUpdate = state.enabledSources.filter(source => 
      state.needsUpdate(source)
    );
    
    if (sourcesToUpdate.length > 0) {
      try {
        await state.fetchBenchmarks(sourcesToUpdate);
      } catch (error) {
        console.error('Auto-update failed:', error);
      }
    }
  }, updateInterval * 60 * 1000); // Convert minutes to milliseconds
};

export const stopBenchmarkAutoUpdate = () => {
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
  }
};

export default useBenchmarksStore;