// Custom hook for dashboard data integration with extension messaging
import { useCallback, useEffect, useState } from 'react';
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

  const gameIsLoading = useGameDataStore((state) => state.isLoading);
  const loadDataFromExtension = useGameDataStore((state) => state.loadDataFromExtension);
  const benchmarkIsLoading = useBenchmarksStore((state) => state.isLoading);
  const fetchBenchmarks = useBenchmarksStore((state) => state.fetchBenchmarks);
  const loadPreferences = usePreferencesStore((state) => state.loadPreferences);

  const isLoading = gameIsLoading || benchmarkIsLoading;

  const refreshData = useCallback(async () => {
    try {
      setError(null);
      
      // Load data from extension in parallel
      await Promise.all([
        loadDataFromExtension(),
        fetchBenchmarks(),
        loadPreferences()
      ]);
      
      setInitialized(true);
    } catch (err) {
      console.error('[Dashboard] Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    }
  }, [fetchBenchmarks, loadDataFromExtension, loadPreferences]);

  // Initialize on mount
  useEffect(() => {
    if (!initialized) {
      refreshData();
    }
  }, [initialized, refreshData]);

  return {
    isLoading,
    error,
    initialized,
    refreshData
  };
};

export default useDashboardData;