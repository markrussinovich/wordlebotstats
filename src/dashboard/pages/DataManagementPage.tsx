// Dashboard data management page for import/export and data operations
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, Button, Input } from '@/components/ui';
import { useGameDataStore } from '@/stores/gameData';
import { usePreferencesStore } from '@/stores/preferences';

const DataManagementPage: React.FC = () => {
  const { games, addGame, clearAllGames } = useGameDataStore();
  const { exportData, importData } = usePreferencesStore();

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'csv' | 'json' | 'share'>('json');
  const [shareText, setShareText] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileImport = async () => {
    if (!importFile) return;

    setIsProcessing(true);
    try {
      const text = await importFile.text();
      
      if (importType === 'json') {
        const data = JSON.parse(text);
        await importData(data);
      } else if (importType === 'csv') {
        // Parse CSV format
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = lines[i].split(',').map(v => v.trim());
          const gameData: any = {};
          
          headers.forEach((header, index) => {
            gameData[header] = values[index];
          });

          // Convert to GameResult format
          const gameResult = {
            puzzle: parseInt(gameData.puzzle) || 0,
            date: gameData.date || new Date().toISOString().split('T')[0],
            won: gameData.won === 'true' || gameData.won === '1',
            guesses: parseInt(gameData.guesses) || null,
            time: parseInt(gameData.time) || null,
            hardMode: gameData.hardMode === 'true' || gameData.hardMode === '1',
            shareText: gameData.shareText || '',
            source: 'csv-import' as const
          };

          addGame(gameResult);
        }
      }

      setImportFile(null);
      // Success feedback would be shown via toast
    } catch (error) {
      console.error('Import failed:', error);
      // Error feedback would be shown via toast
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareTextImport = () => {
    if (!shareText.trim()) return;

    setIsProcessing(true);
    try {
      // Parse Wordle share text format
      const lines = shareText.trim().split('\n');
      const firstLine = lines[0];
      
      // Extract puzzle number and score
      const puzzleMatch = firstLine.match(/Wordle (\d+) (\d+|X)\/6/);
      if (!puzzleMatch) {
        throw new Error('Invalid Wordle share format');
      }

      const puzzle = parseInt(puzzleMatch[1]);
      const scoreStr = puzzleMatch[2];
      const won = scoreStr !== 'X';
      const guesses = won ? parseInt(scoreStr) : null;

      // Create game result
      const gameResult = {
        puzzle,
        date: new Date().toISOString().split('T')[0], // Use current date
        won,
        guesses,
        time: null,
        hardMode: shareText.includes('*'), // Hard mode indicated by asterisk
        shareText: shareText,
        source: 'share-import' as const
      };

      addGame(gameResult);
      setShareText('');
      // Success feedback would be shown via toast
    } catch (error) {
      console.error('Share text import failed:', error);
      // Error feedback would be shown via toast
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportData = async () => {
    setIsProcessing(true);
    try {
      await exportData();
      // Success feedback would be shown via toast
    } catch (error) {
      console.error('Export failed:', error);
      // Error feedback would be shown via toast
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAllData = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    setIsProcessing(true);
    try {
      await clearAllGames();
      setShowClearConfirm(false);
      // Success feedback would be shown via toast
    } catch (error) {
      console.error('Clear data failed:', error);
      // Error feedback would be shown via toast
    } finally {
      setIsProcessing(false);
    }
  };

  const getDataStats = () => {
    const totalGames = games.length;
    const wonGames = games.filter(g => g.won).length;
    const estimatedSize = Math.round((JSON.stringify(games).length) / 1024); // KB estimate
    
    return { totalGames, wonGames, estimatedSize };
  };

  const stats = getDataStats();

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Data Management</h1>
        <p className="text-gray-600 mt-1">
          Import, export, and manage your Wordle game data
        </p>
      </div>

      {/* Current Data Overview */}
      <Card>
        <CardHeader title="Current Data" subtitle="Overview of your stored games" />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalGames}</div>
              <div className="text-sm text-gray-600">Total Games</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.wonGames}</div>
              <div className="text-sm text-gray-600">Games Won</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.estimatedSize} KB</div>
              <div className="text-sm text-gray-600">Storage Used</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import Data */}
      <Card>
        <CardHeader title="Import Data" subtitle="Add games from various sources" />
        <CardContent>
          <div className="space-y-6">
            {/* Import Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Import Source
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="json"
                    checked={importType === 'json'}
                    onChange={(e) => setImportType(e.target.value as any)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">JSON File</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="csv"
                    checked={importType === 'csv'}
                    onChange={(e) => setImportType(e.target.value as any)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">CSV File</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="share"
                    checked={importType === 'share'}
                    onChange={(e) => setImportType(e.target.value as any)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Share Text</span>
                </label>
              </div>
            </div>

            {/* File Import */}
            {(importType === 'json' || importType === 'csv') && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  {importType === 'json' ? 'JSON File Import' : 'CSV File Import'}
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  {importType === 'json' 
                    ? 'Import from a previously exported Wordle Stat Explorer file'
                    : 'Import from a CSV file with columns: puzzle, date, won, guesses, hardMode'
                  }
                </p>
                <div className="flex items-center space-x-3">
                  <Input
                    type="file"
                    accept={importType === 'json' ? '.json' : '.csv'}
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="flex-1"
                    disabled={isProcessing}
                  />
                  <Button 
                    onClick={handleFileImport}
                    disabled={!importFile || isProcessing}
                    size="sm"
                  >
                    {isProcessing ? 'Importing...' : 'Import'}
                  </Button>
                </div>
              </div>
            )}

            {/* Share Text Import */}
            {importType === 'share' && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Wordle Share Text Import
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Paste the text you copied from Wordle's share button
                </p>
                <div className="space-y-3">
                  <textarea
                    value={shareText}
                    onChange={(e) => setShareText(e.target.value)}
                    placeholder="Wordle 123 4/6&#10;&#10;⬛⬛🟨⬛⬛&#10;⬛🟨⬛⬛🟩&#10;🟨⬛⬛🟩🟩&#10;🟩🟩🟩🟩🟩"
                    className="w-full h-24 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <Button 
                    onClick={handleShareTextImport}
                    disabled={!shareText.trim() || isProcessing}
                    size="sm"
                  >
                    {isProcessing ? 'Importing...' : 'Import Share Text'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Data */}
      <Card>
        <CardHeader title="Export Data" subtitle="Download your game data and settings" />
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Complete Data Export</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Downloads all games, statistics, and settings as a JSON file
                </p>
              </div>
              <Button 
                onClick={handleExportData}
                variant="outline"
                size="sm"
                disabled={isProcessing}
              >
                {isProcessing ? 'Exporting...' : 'Export All Data'}
              </Button>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
              <strong>Export includes:</strong> All game results, personal statistics, 
              user preferences, and benchmark data. Use this for backup or transferring 
              to another device.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Operations */}
      <Card>
        <CardHeader title="Data Operations" subtitle="Dangerous operations - use with caution" />
        <CardContent>
          <div className="space-y-4">
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <h4 className="text-sm font-medium text-red-900 mb-2">Clear All Data</h4>
              <p className="text-xs text-red-700 mb-3">
                This will permanently delete all your game data, statistics, and settings. 
                This action cannot be undone.
              </p>
              <div className="flex items-center space-x-3">
                <Button 
                  onClick={handleClearAllData}
                  variant={showClearConfirm ? "destructive" : "outline"}
                  size="sm"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Clearing...' : 
                   showClearConfirm ? 'Confirm Clear All Data' : 'Clear All Data'}
                </Button>
                {showClearConfirm && (
                  <Button 
                    onClick={() => setShowClearConfirm(false)}
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                )}
              </div>
              {showClearConfirm && (
                <p className="text-xs text-red-600 mt-2 font-medium">
                  Are you sure? This will delete {stats.totalGames} games and all settings.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataManagementPage;