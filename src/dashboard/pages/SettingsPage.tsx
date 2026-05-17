// Dashboard settings page for user preferences and configuration
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, Button, Input, Select } from '@/components/ui';
import { usePreferencesStore } from '@/stores/preferences';

const SettingsPage: React.FC = () => {
  const { 
    preferences, 
    updatePreferences,
    exportData,
    importData,
    resetAllData 
  } = usePreferencesStore();

  const [importFile, setImportFile] = useState<File | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updatePreferences({ theme });
  };

  const handleDefaultTimeFrameChange = (defaultTimeFrame: '7d' | '30d' | '90d' | 'all') => {
    updatePreferences({ defaultTimeFrame });
  };

  const handleBenchmarkSourceChange = (benchmarkSource: 'national' | 'wordlebot') => {
    updatePreferences({ benchmarkSource });
  };

  const handleAutoImportChange = (enabled: boolean) => {
    updatePreferences({ 
      autoImport: { 
        ...preferences.autoImport, 
        enabled 
      } 
    });
  };

  const handleNotificationsChange = (notifications: any) => {
    updatePreferences({ notifications });
  };

  const handleExportData = async () => {
    try {
      await exportData();
      // Export success feedback would be shown via toast/notification
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImportData = async () => {
    if (!importFile) return;

    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      await importData(data);
      setImportFile(null);
      // Import success feedback would be shown via toast/notification
    } catch (error) {
      console.error('Import failed:', error);
    }
  };

  const handleResetData = async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }

    try {
      await resetAllData();
      setShowResetConfirm(false);
      // Reset success feedback would be shown via toast/notification
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure your Wordle Stat Explorer preferences and data management
        </p>
      </div>

      {/* Appearance Settings */}
      <Card>
        <CardHeader title="Appearance" subtitle="Customize the look and feel" />
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Theme
                </label>
                <p className="text-xs text-gray-500">
                  Choose your preferred color theme
                </p>
              </div>
              <Select
                value={preferences.theme}
                onChange={(value) => handleThemeChange(value as 'light' | 'dark' | 'system')}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' }
                ]}
                className="w-32"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Time Frame
                </label>
                <p className="text-xs text-gray-500">
                  Default period for statistics display
                </p>
              </div>
              <Select
                value={preferences.defaultTimeFrame}
                onChange={(value) => handleDefaultTimeFrameChange(value as '7d' | '30d' | '90d' | 'all')}
                options={[
                  { value: '7d', label: 'Last 7 Days' },
                  { value: '30d', label: 'Last 30 Days' },
                  { value: '90d', label: 'Last 90 Days' },
                  { value: 'all', label: 'All Time' }
                ]}
                className="w-32"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Analytics Settings */}
      <Card>
        <CardHeader title="Data & Analytics" subtitle="Configure data collection and analysis" />
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Benchmark Source
                </label>
                <p className="text-xs text-gray-500">
                  Choose comparison data source
                </p>
              </div>
              <Select
                value={preferences.benchmarkSource}
                onChange={(value) => handleBenchmarkSourceChange(value as 'national' | 'wordlebot')}
                options={[
                  { value: 'national', label: 'National Average' },
                  { value: 'wordlebot', label: 'WordleBot' }
                ]}
                className="w-40"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Auto-Import Games
                </label>
                <p className="text-xs text-gray-500">
                  Automatically detect and import games from Wordle page
                </p>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.autoImport.enabled}
                  onChange={(e) => handleAutoImportChange(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Settings */}
      <Card>
        <CardHeader title="Notifications" subtitle="Manage notification preferences" />
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Reminders
                </label>
                <p className="text-xs text-gray-500">
                  Get notified to play daily Wordle
                </p>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.notifications.dailyReminder}
                  onChange={(e) => handleNotificationsChange({
                    ...preferences.notifications,
                    dailyReminder: e.target.checked
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable</span>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Achievement Notifications
                </label>
                <p className="text-xs text-gray-500">
                  Get notified when you achieve milestones
                </p>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.notifications.achievements}
                  onChange={(e) => handleNotificationsChange({
                    ...preferences.notifications,
                    achievements: e.target.checked
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable</span>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weekly Summary
                </label>
                <p className="text-xs text-gray-500">
                  Receive weekly performance summaries
                </p>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.notifications.weeklyDigest}
                  onChange={(e) => handleNotificationsChange({
                    ...preferences.notifications,
                    weeklyDigest: e.target.checked
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader title="Data Management" subtitle="Import, export, and manage your data" />
        <CardContent>
          <div className="space-y-6">
            {/* Export Data */}
            <div className="border-b border-gray-200 pb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Export Data</h4>
              <p className="text-xs text-gray-500 mb-3">
                Download all your game data and settings as a JSON file
              </p>
              <Button 
                onClick={handleExportData}
                variant="outline"
                size="sm"
              >
                Export All Data
              </Button>
            </div>

            {/* Import Data */}
            <div className="border-b border-gray-200 pb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Import Data</h4>
              <p className="text-xs text-gray-500 mb-3">
                Import game data from a previously exported file
              </p>
              <div className="flex items-center space-x-3">
                <Input
                  type="file"
                  accept=".json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleImportData}
                  disabled={!importFile}
                  size="sm"
                >
                  Import
                </Button>
              </div>
            </div>

            {/* Reset Data */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Reset All Data</h4>
              <p className="text-xs text-gray-500 mb-3">
                Permanently delete all game data and reset to defaults
              </p>
              <div className="flex items-center space-x-3">
                <Button 
                  onClick={handleResetData}
                  variant={showResetConfirm ? "destructive" : "outline"}
                  size="sm"
                >
                  {showResetConfirm ? "Confirm Reset" : "Reset All Data"}
                </Button>
                {showResetConfirm && (
                  <Button 
                    onClick={() => setShowResetConfirm(false)}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                )}
              </div>
              {showResetConfirm && (
                <p className="text-xs text-red-600 mt-2">
                  This action cannot be undone. All your game data will be permanently deleted.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Information */}
      <Card>
        <CardHeader title="Storage Information" subtitle="Current data usage" />
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Games</span>
              <span className="text-sm font-medium text-gray-900">
                {/* This would come from storage service */}
                — games
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Storage Used</span>
              <span className="text-sm font-medium text-gray-900">
                {/* This would come from storage service */}
                — KB
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last Backup</span>
              <span className="text-sm font-medium text-gray-900">
                {/* This would come from storage service */}
                Never
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;