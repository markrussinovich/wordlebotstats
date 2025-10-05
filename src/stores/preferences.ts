// User preferences Zustand store for managing user settings and configuration
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserPreferences } from '@/types/gameTypes';
import { TimeFrame, BenchmarkSource } from '@/types/benchmarkTypes';

interface PreferencesState extends UserPreferences {
  // Extend base preferences with additional UI state
  isLoading: boolean;
  error: string | null;
  lastSyncTime: string | null;
  hasUnsavedChanges: boolean;
}

interface PreferencesActions {
  // Theme management
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
  
  // Time frame preferences
  setDefaultTimeFrame: (timeFrame: TimeFrame) => void;
  
  // Benchmark preferences
  setBenchmarkSources: (sources: BenchmarkSource[]) => void;
  toggleBenchmarkSource: (source: BenchmarkSource) => void;
  setShowBenchmarks: (show: boolean) => void;
  
  // Notification preferences
  setNotificationsEnabled: (enabled: boolean) => void;
  setStreakNotifications: (enabled: boolean) => void;
  setDailyReminders: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  
  // Import/Export preferences
  setAutoImport: (enabled: boolean) => void;
  setAutoExport: (enabled: boolean) => void;
  setExportFrequency: (frequency: 'daily' | 'weekly' | 'monthly') => void;
  
  // Privacy preferences
  setDataSharing: (enabled: boolean) => void;
  setAnalytics: (enabled: boolean) => void;
  
  // Display preferences
  setCompactMode: (enabled: boolean) => void;
  setShowTrends: (enabled: boolean) => void;
  setShowComparisons: (enabled: boolean) => void;
  setChartType: (type: 'bar' | 'line' | 'pie') => void;
  
  // Data management
  resetToDefaults: () => void;
  saveChanges: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  exportPreferences: () => string;
  importPreferences: (data: string) => void;
  
  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markAsChanged: () => void;
  markAsSaved: () => void;
}

type PreferencesStore = PreferencesState & PreferencesActions;

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  defaultTimeFrame: '30d',
  benchmarkSources: ['national', 'wordlebot'],
  showBenchmarks: true,
  notifications: {
    enabled: false,
    dailyReminder: false,
    achievements: false,
    weeklyDigest: false,
    streakAlerts: true,
    reminderTime: '09:00'
  },
  privacy: {
    dataSharing: false,
    analytics: true
  },
  display: {
    compactMode: false,
    showTrends: true,
    showComparisons: true,
    chartType: 'bar'
  },
  import: {
    autoImport: true,
    sources: ['wordle-nyt']
  },
  export: {
    autoExport: false,
    frequency: 'weekly',
    format: 'json'
  }
};

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    immer((set, get) => ({
      // Initial state (spread defaults and add store-specific state)
      ...DEFAULT_PREFERENCES,
      isLoading: false,
      error: null,
      lastSyncTime: null,
      hasUnsavedChanges: false,

      // Theme management
      setTheme: (theme) => set(state => {
        state.theme = theme;
        state.hasUnsavedChanges = true;
        
        // Apply theme immediately to document
        applyThemeToDocument(theme);
      }),

      toggleTheme: () => {
        const currentTheme = get().theme;
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        get().setTheme(nextTheme);
      },

      // Time frame preferences
      setDefaultTimeFrame: (timeFrame) => set(state => {
        state.defaultTimeFrame = timeFrame;
        state.hasUnsavedChanges = true;
      }),

      // Benchmark preferences
      setBenchmarkSources: (sources) => set(state => {
        state.benchmarkSource = sources;
        state.hasUnsavedChanges = true;
      }),

      toggleBenchmarkSource: (source) => set(state => {
        const current = state.benchmarkSource;
        if (current.includes(source)) {
          state.benchmarkSource = current.filter((s: any) => s !== source);
        } else {
          state.benchmarkSource = [...current, source];
        }
        state.hasUnsavedChanges = true;
      }),

      setShowBenchmarks: (show) => set(state => {
        state.setShowBenchmarks = show;
        state.hasUnsavedChanges = true;
      }),

      // Notification preferences
      setNotificationsEnabled: (enabled) => set(state => {
        state.notifications!.enabled = enabled;
        state.hasUnsavedChanges = true;
      }),

      setStreakNotifications: (enabled) => set(state => {
        state.notifications!.streakAlerts = enabled;
        state.hasUnsavedChanges = true;
      }),

      setDailyReminders: (enabled) => set(state => {
        state.notifications!.dailyReminder = enabled;
        state.hasUnsavedChanges = true;
      }),

      setReminderTime: (time) => set(state => {
        state.notifications!.reminderTime = time;
        state.hasUnsavedChanges = true;
      }),

      // Import/Export preferences
      setAutoImport: (enabled) => set(state => {
        // state.import.autoImport = enabled;
        state.hasUnsavedChanges = true;
      }),

      setAutoExport: (enabled) => set(state => {
        // state.export.autoExport = enabled;
        state.hasUnsavedChanges = true;
      }),

      setExportFrequency: (frequency) => set(state => {
        // state.export.frequency = frequency;
        state.hasUnsavedChanges = true;
      }),

      // Privacy preferences
      setDataSharing: (enabled) => set(state => {
        // state.privacy.dataSharing = enabled;
        state.hasUnsavedChanges = true;
      }),

      setAnalytics: (enabled) => set(state => {
        // state.privacy.analytics = enabled;
        state.hasUnsavedChanges = true;
      }),

      // Display preferences
      setCompactMode: (enabled) => set(state => {
        // state.display.compactMode = enabled;
        state.hasUnsavedChanges = true;
      }),

      setShowTrends: (enabled) => set(state => {
        // state.display.showTrends = enabled;
        state.hasUnsavedChanges = true;
      }),

      setShowComparisons: (enabled) => set(state => {
        // state.display.showComparisons = enabled;
        state.hasUnsavedChanges = true;
      }),

      setChartType: (type) => set(state => {
        state.display.chartType = type;
        state.hasUnsavedChanges = true;
      }),

      // Data management
      resetToDefaults: () => set(state => {
        Object.assign(state, DEFAULT_PREFERENCES);
        state.hasUnsavedChanges = true;
        
        // Apply default theme
        applyThemeToDocument(DEFAULT_PREFERENCES.theme);
      }),

      saveChanges: async () => {
        set(state => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          // In a real implementation, this would sync to cloud storage
          // For now, just mark as saved (persistence middleware handles local storage)
          
          await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
          
          set(state => {
            state.hasUnsavedChanges = false;
            state.lastSyncTime = new Date().toISOString();
            state.isLoading = false;
          });

        } catch (error) {
          set(state => {
            state.error = error instanceof Error ? error.message : 'Failed to save preferences';
            state.isLoading = false;
          });
          throw error;
        }
      },

      loadPreferences: async () => {
        set(state => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          // In a real implementation, this would load from cloud storage
          // The persist middleware already handles loading from localStorage
          
          await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API call
          
          set(state => {
            state.isLoading = false;
            state.lastSyncTime = new Date().toISOString();
          });

          // Apply current theme
          const currentTheme = get().theme;
          applyThemeToDocument(currentTheme);

        } catch (error) {
          set(state => {
            state.error = error instanceof Error ? error.message : 'Failed to load preferences';
            state.isLoading = false;
          });
          throw error;
        }
      },

      exportPreferences: () => {
        const state = get();
        const exportData = {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          preferences: {
            theme: state.theme,
            defaultTimeFrame: state.defaultTimeFrame,
            benchmarkSource: state.benchmarkSource,
            // showBenchmarks: state.showBenchmarks,
            notifications: state.notifications
            // privacy: state.privacy,
            // display: state.display,
            // import: state.import,
            // export: state.export
          }
        };
        
        return JSON.stringify(exportData, null, 2);
      },

      importPreferences: (data) => {
        try {
          const importData = JSON.parse(data);
          
          if (!importData.preferences) {
            throw new Error('Invalid preferences format');
          }

          set(state => {
            Object.assign(state, importData.preferences);
            state.hasUnsavedChanges = true;
          });

          // Apply imported theme
          applyThemeToDocument(importData.preferences.theme || 'system');

        } catch (error) {
          set(state => {
            state.error = error instanceof Error ? error.message : 'Failed to import preferences';
          });
          throw error;
        }
      },

      // State management
      setLoading: (loading) => set(state => {
        state.isLoading = loading;
      }),

      setError: (error) => set(state => {
        state.error = error;
      }),

      markAsChanged: () => set(state => {
        state.hasUnsavedChanges = true;
      }),

      markAsSaved: () => set(state => {
        state.hasUnsavedChanges = false;
        state.lastSyncTime = new Date().toISOString();
      })
    })),
    {
      name: 'wordle-stats-preferences',
      storage: createJSONStorage(() => {
        // Use chrome.storage.sync for extension context, localStorage for web
        if (typeof chrome !== 'undefined' && chrome.storage) {
          return {
            getItem: async (name: string) => {
              const result = await chrome.storage.sync.get(name);
              return result[name] || null;
            },
            setItem: async (name: string, value: string) => {
              await chrome.storage.sync.set({ [name]: value });
            },
            removeItem: async (name: string) => {
              await chrome.storage.sync.remove(name);
            }
          };
        }
        return localStorage;
      }),
      partialize: (state) => ({
        // Only persist user preferences, not transient state
        theme: state.theme,
        defaultTimeFrame: state.defaultTimeFrame,
        benchmarkSource: state.benchmarkSource,
        // showBenchmarks: state.showBenchmarks,
        notifications: state.notifications
        // privacy: state.privacy,
        // display: state.display,
        // import: state.import,
        // export: state.export
      })
    }
  )
);

// Theme application utility
function applyThemeToDocument(theme: 'light' | 'dark' | 'system') {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  
  if (theme === 'system') {
    // Use system preference
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

// Initialize theme on store creation
if (typeof window !== 'undefined') {
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const currentTheme = usePreferencesStore.getState().theme;
    if (currentTheme === 'system') {
      applyThemeToDocument('system');
    }
  });

  // Apply initial theme
  const initialTheme = usePreferencesStore.getState().theme;
  applyThemeToDocument(initialTheme);
}

export default usePreferencesStore;