// Custom hook for dashboard data integration with extension messaging
import { useEffect, useState } from 'react';
import { useGameDataStore } from '@/stores/gameData';
import { useBenchmarksStore } from '@/stores/benchmarks';
import { usePreferencesStore } from '@/stores/preferences';

export interface DashboardDataHook {
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  refreshData: () => Promise<void>;
}

export const useDashboardData = (): DashboardDataHook => {
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const gameStore = useGameDataStore();
  const benchmarkStore = useBenchmarksStore();
  const preferencesStore = usePreferencesStore();

  const isLoading = gameStore.isLoading || benchmarkStore.isLoading;

  const refreshData = async () => {
    try {
      setError(null);
      
      // Load data from extension in parallel
      await Promise.all([
        gameStore.loadDataFromExtension(),
        benchmarkStore.fetchBenchmarks(),
        preferencesStore.loadPreferences()
      ]);
      
      setInitialized(true);
    } catch (err) {
      console.error('[Dashboard] Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    }
  };

  // Initialize on mount
  useEffect(() => {
    if (!initialized) {
      refreshData();
    }
  }, [initialized]);

  return {
    isLoading,
    error,
    initialized,
    refreshData
  };
};

export default useDashboardData;