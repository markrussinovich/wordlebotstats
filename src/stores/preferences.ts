// User preferences Zustand store for dashboard settings and extension integration
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserPreferences } from '@/types/gameTypes';
import { TimeFrame, BenchmarkSource } from '@/types/benchmarkTypes';
import { MessageType } from '@/types/messagingTypes';

type ThemePreference = 'light' | 'dark' | 'system';

type DashboardPreferences = Omit<UserPreferences, 'theme' | 'autoImport' | 'notifications'> & {
  theme: ThemePreference;
  showBenchmarks: boolean;
  autoImport: {
    enabled: boolean;
  };
  notifications: {
    enabled?: boolean;
    dailyReminder: boolean;
    achievements: boolean;
    weeklyDigest: boolean;
    streakAlerts?: boolean;
    reminderTime?: string;
  };
};

type PreferencePatch = Partial<Omit<DashboardPreferences, 'autoImport' | 'notifications'>> & {
  autoImport?: Partial<DashboardPreferences['autoImport']>;
  notifications?: Partial<DashboardPreferences['notifications']>;
};

interface PreferencesState {
  preferences: DashboardPreferences;
  isLoading: boolean;
  error: string | null;
  lastSyncTime: string | null;
  hasUnsavedChanges: boolean;
}

interface PreferencesActions {
  // Compatibility API used by dashboard pages
  updatePreferences: (updates: PreferencePatch) => void;
  exportData: () => Promise<void>;
  importData: (data: unknown) => Promise<void>;
  resetAllData: () => Promise<void>;

  // Existing API used by hooks/components
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  setDefaultTimeFrame: (timeFrame: TimeFrame) => void;
  setBenchmarkSources: (sources: BenchmarkSource[]) => void;
  toggleBenchmarkSource: (source: BenchmarkSource) => void;
  setShowBenchmarks: (show: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setStreakNotifications: (enabled: boolean) => void;
  setDailyReminders: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setAutoImport: (enabled: boolean) => void;
  setAutoExport: (_enabled: boolean) => void;
  setExportFrequency: (_frequency: 'daily' | 'weekly' | 'monthly') => void;
  setDataSharing: (_enabled: boolean) => void;
  setAnalytics: (_enabled: boolean) => void;
  setCompactMode: (_enabled: boolean) => void;
  setShowTrends: (_enabled: boolean) => void;
  setShowComparisons: (_enabled: boolean) => void;
  setChartType: (_type: 'bar' | 'line' | 'pie') => void;
  resetToDefaults: () => void;
  saveChanges: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  exportPreferences: () => string;
  importPreferences: (data: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markAsChanged: () => void;
  markAsSaved: () => void;
}

type PreferencesStore = PreferencesState & PreferencesActions;

const DEFAULT_PREFERENCES: DashboardPreferences = {
  theme: 'system',
  defaultTimeFrame: '30d',
  benchmarkSource: 'national',
  showBenchmarks: true,
  notifications: {
    enabled: false,
    dailyReminder: false,
    achievements: false,
    weeklyDigest: false,
    streakAlerts: true,
    reminderTime: '09:00'
  },
  autoImport: {
    enabled: true
  }
};

function applyThemeToDocument(theme: ThemePreference) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (theme === 'system') {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
    return;
  }

  root.setAttribute('data-theme', theme);
}

function triggerJsonDownload(filename: string, content: string) {
  if (typeof document === 'undefined') return;

  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    immer((set, get) => ({
      preferences: { ...DEFAULT_PREFERENCES },
      isLoading: false,
      error: null,
      lastSyncTime: null,
      hasUnsavedChanges: false,

      updatePreferences: (updates) => set((state) => {
        state.preferences = {
          ...state.preferences,
          ...updates,
          notifications: {
            ...state.preferences.notifications,
            ...updates.notifications
          },
          autoImport: {
            ...state.preferences.autoImport,
            ...updates.autoImport
          }
        };

        if (updates.theme) {
          state.preferences.theme = updates.theme;
          applyThemeToDocument(state.preferences.theme);
        }

        state.hasUnsavedChanges = true;
      }),

      exportData: async () => {
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            const response = await chrome.runtime.sendMessage({ type: MessageType.EXPORT_DATA });
            if (response?.data && response?.filename) {
              triggerJsonDownload(response.filename, response.data);
              return;
            }
          }

          const fallback = get().exportPreferences();
          triggerJsonDownload('wordle-preferences.json', fallback);
        } catch (error) {
          console.error('[PreferencesStore] Failed to export data:', error);
          throw error;
        }
      },

      importData: async (data) => {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown>);
          const payload = parsed || {};

          if (payload.preferences && typeof payload.preferences === 'object') {
            get().updatePreferences(payload.preferences as PreferencePatch);
          }

          if (Array.isArray(payload.games) && typeof chrome !== 'undefined' && chrome.runtime) {
            await chrome.runtime.sendMessage({
              type: 'BULK_IMPORT_GAMES',
              games: payload.games
            });
          }

          get().markAsSaved();
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to import data';
          });
          throw error;
        }
      },

      resetAllData: async () => {
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            await chrome.runtime.sendMessage({ type: MessageType.CLEAR_DATA });
          }
        } catch (error) {
          console.warn('[PreferencesStore] Failed to clear extension data, resetting preferences locally:', error);
        }

        get().resetToDefaults();
      },

      setTheme: (theme) => {
        get().updatePreferences({ theme });
      },

      toggleTheme: () => {
        const currentTheme = get().preferences.theme;
        const nextTheme: ThemePreference = currentTheme === 'light' ? 'dark' : 'light';
        get().setTheme(nextTheme);
      },

      setDefaultTimeFrame: (timeFrame) => {
        get().updatePreferences({ defaultTimeFrame: timeFrame });
      },

      setBenchmarkSources: (sources) => {
        const primarySource = sources[0] || 'national';
        get().updatePreferences({ benchmarkSource: primarySource });
      },

      toggleBenchmarkSource: (source) => {
        get().updatePreferences({ benchmarkSource: source });
      },

      setShowBenchmarks: (show) => {
        get().updatePreferences({ showBenchmarks: show });
      },

      setNotificationsEnabled: (enabled) => {
        get().updatePreferences({ notifications: { enabled } });
      },

      setStreakNotifications: (enabled) => {
        get().updatePreferences({ notifications: { streakAlerts: enabled } });
      },

      setDailyReminders: (enabled) => {
        get().updatePreferences({ notifications: { dailyReminder: enabled } });
      },

      setReminderTime: (time) => {
        get().updatePreferences({ notifications: { reminderTime: time } });
      },

      setAutoImport: (enabled) => {
        get().updatePreferences({ autoImport: { enabled } });
      },

      setAutoExport: (_enabled) => {
        set((state) => {
          state.hasUnsavedChanges = true;
        });
      },

      setExportFrequency: (_frequency) => {
        set((state) => {
          state.hasUnsavedChanges = true;
        });
      },

      setDataSharing: (_enabled) => {
        set((state) => {
          state.hasUnsavedChanges = true;
        });
      },

      setAnalytics: (_enabled) => {
        set((state) => {
          state.hasUnsavedChanges = true;
        });
      },

      setCompactMode: (_enabled) => {
        set((state) => {
          state.hasUnsavedChanges = true;
        });
      },

      setShowTrends: (_enabled) => {
        set((state) => {
          state.hasUnsavedChanges = true;
        });
      },

      setShowComparisons: (_enabled) => {
        set((state) => {
          state.hasUnsavedChanges = true;
        });
      },

      setChartType: (_type) => {
        set((state) => {
          state.hasUnsavedChanges = true;
        });
      },

      resetToDefaults: () => set((state) => {
        state.preferences = { ...DEFAULT_PREFERENCES };
        state.hasUnsavedChanges = true;
        applyThemeToDocument(DEFAULT_PREFERENCES.theme);
      }),

      saveChanges: async () => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          set((state) => {
            state.hasUnsavedChanges = false;
            state.lastSyncTime = new Date().toISOString();
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to save preferences';
            state.isLoading = false;
          });
          throw error;
        }
      },

      loadPreferences: async () => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          set((state) => {
            state.isLoading = false;
            state.lastSyncTime = new Date().toISOString();
          });

          applyThemeToDocument(get().preferences.theme);
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to load preferences';
            state.isLoading = false;
          });
          throw error;
        }
      },

      exportPreferences: () => {
        const { preferences } = get();
        const exportPayload = {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          preferences
        };
        return JSON.stringify(exportPayload, null, 2);
      },

      importPreferences: (data) => {
        try {
          const parsed = JSON.parse(data) as { preferences?: PreferencePatch };
          if (!parsed.preferences) {
            throw new Error('Invalid preferences format');
          }
          get().updatePreferences(parsed.preferences);
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to import preferences';
          });
          throw error;
        }
      },

      setLoading: (loading) => set((state) => {
        state.isLoading = loading;
      }),

      setError: (error) => set((state) => {
        state.error = error;
      }),

      markAsChanged: () => set((state) => {
        state.hasUnsavedChanges = true;
      }),

      markAsSaved: () => set((state) => {
        state.hasUnsavedChanges = false;
        state.lastSyncTime = new Date().toISOString();
      })
    })),
    {
      name: 'wordle-stats-preferences',
      storage: createJSONStorage(() => {
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
        preferences: state.preferences
      })
    }
  )
);

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const currentTheme = usePreferencesStore.getState().preferences.theme;
    if (currentTheme === 'system') {
      applyThemeToDocument('system');
    }
  });

  applyThemeToDocument(usePreferencesStore.getState().preferences.theme);
}

export default usePreferencesStore;
