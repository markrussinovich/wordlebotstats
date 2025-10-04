// E2E test for dashboard deep analysis scenarios
import { test, expect } from '@playwright/test';

test.describe('Dashboard Deep Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Add mock data for realistic testing
    await page.addInitScript(() => {
      const mockGames = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        date: new Date(Date.now() - (100 - i) * 24 * 60 * 60 * 1000).toISOString(),
        guesses: Math.floor(Math.random() * 6) + 1,
        won: Math.random() > 0.15, // ~85% win rate
        hardMode: Math.random() > 0.7,
        word: `WORD${i + 1}`
      }));
      
      window.localStorage.setItem('wordle-games', JSON.stringify(mockGames));
      
      const mockBenchmarks = {
        globalAverage: { winRate: 82.3, avgGuesses: 4.2 },
        expertPlayers: { winRate: 94.1, avgGuesses: 3.8 }
      };
      
      window.localStorage.setItem('wordle-benchmarks', JSON.stringify(mockBenchmarks));
    });
    
    await page.goto('/dashboard');
  });

  test('should navigate between dashboard pages', async ({ page }) => {
    // Test Overview page
    await expect(page.locator('h1')).toContainText('Wordle Stat Explorer');
    await expect(page.locator('[data-testid="overview-content"]')).toBeVisible();
    
    // Navigate to Analytics
    await page.click('[href="/analytics"]');
    await expect(page.locator('h2')).toContainText('Performance Analytics');
    await expect(page.locator('[data-testid="analytics-content"]')).toBeVisible();
    
    // Navigate to Data Management
    await page.click('[href="/data"]');
    await expect(page.locator('h2')).toContainText('Data Management');
    await expect(page.locator('[data-testid="data-management-content"]')).toBeVisible();
    
    // Navigate to Settings
    await page.click('[href="/settings"]');
    await expect(page.locator('h2')).toContainText('Settings');
    await expect(page.locator('[data-testid="settings-content"]')).toBeVisible();
    
    // Navigate back to Overview
    await page.click('[href="/"]');
    await expect(page.locator('[data-testid="overview-content"]')).toBeVisible();
  });

  test('should display comprehensive statistics', async ({ page }) => {
    // Test stat cards are present
    await expect(page.locator('[data-testid="stat-card"]')).toHaveCount(4);
    
    // Test specific stat values
    await expect(page.locator('[aria-labelledby="win-rate-label"]')).toBeVisible();
    await expect(page.locator('[aria-labelledby="avg-guesses-label"]')).toBeVisible();
    await expect(page.locator('[aria-labelledby="current-streak-label"]')).toBeVisible();
    await expect(page.locator('[aria-labelledby="max-streak-label"]')).toBeVisible();
    
    // Test that values are displayed (not just placeholders)
    const winRateText = await page.locator('[aria-labelledby="win-rate-label"] .stat-value').textContent();
    expect(winRateText).toMatch(/\d+\.?\d*%/);
    
    const avgGuessesText = await page.locator('[aria-labelledby="avg-guesses-label"] .stat-value').textContent();
    expect(avgGuessesText).toMatch(/\d+\.?\d*/);
  });

  test('should render interactive charts', async ({ page }) => {
    await page.click('[href="/analytics"]');
    
    // Test trend chart is present
    await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible();
    
    // Test guess distribution chart
    await expect(page.locator('[data-testid="guess-distribution-chart"]')).toBeVisible();
    
    // Test comparison chart
    await expect(page.locator('[data-testid="comparison-chart"]')).toBeVisible();
    
    // Test chart interactivity (hover, tooltips)
    await page.hover('[data-testid="trend-chart"] .recharts-line');
    // Tooltips should appear on hover (implementation specific)
  });

  test('should handle time period filtering', async ({ page }) => {
    // Test time period selector
    await expect(page.locator('[data-testid="time-period-selector"]')).toBeVisible();
    
    // Test different time periods
    const periods = ['7d', '30d', '90d', 'all'];
    
    for (const period of periods) {
      await page.selectOption('[data-testid="time-period-selector"]', period);
      
      // Stats should update
      await expect(page.locator('[data-testid="stat-card"]')).toHaveCount(4);
      
      // Charts should re-render (wait for loading to complete)
      await page.waitForTimeout(500); // Allow for chart updates
    }
  });
});

test.describe('Performance Comparison Features', () => {
  test('should display benchmark comparisons', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    
    // Test comparison cards
    await expect(page.locator('[data-testid="comparison-global"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-expert"]')).toBeVisible();
    
    // Test comparison values
    const globalComparison = page.locator('[data-testid="comparison-global"] .comparison-value');
    await expect(globalComparison).toBeVisible();
    
    const expertComparison = page.locator('[data-testid="comparison-expert"] .comparison-value');
    await expect(expertComparison).toBeVisible();
  });

  test('should handle benchmark data updates', async ({ page }) => {
    await page.goto('/dashboard/data');
    
    // Test refresh benchmarks button
    await expect(page.locator('[data-testid="refresh-benchmarks"]')).toBeVisible();
    
    // Click refresh (should trigger loading state)
    await page.click('[data-testid="refresh-benchmarks"]');
    
    // Should show loading state briefly
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    
    // Should complete and show success
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
  });
});

test.describe('Data Management Workflows', () => {
  test('should handle data export', async ({ page }) => {
    await page.goto('/dashboard/data');
    
    // Test export buttons
    await expect(page.locator('[data-testid="export-csv"]')).toBeVisible();
    await expect(page.locator('[data-testid="export-json"]')).toBeVisible();
    
    // Test CSV export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-csv"]')
    ]);
    
    expect(download.suggestedFilename()).toMatch(/wordle-stats.*\.csv/);
    
    // Test JSON export
    const [jsonDownload] = await Promise.all([
      page.waitForEvent('download'),  
      page.click('[data-testid="export-json"]')
    ]);
    
    expect(jsonDownload.suggestedFilename()).toMatch(/wordle-data.*\.json/);
  });

  test('should handle data import', async ({ page }) => {
    await page.goto('/dashboard/data');
    
    // Test import file input
    await expect(page.locator('[data-testid="import-file"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-button"]')).toBeVisible();
    
    // Test file selection (simulate)
    const fileInput = page.locator('[data-testid="import-file"]');
    await fileInput.setInputFiles('tests/fixtures/sample-wordle-data.json');
    
    // Test import button activation
    await page.click('[data-testid="import-button"]');
    
    // Should show processing state
    await expect(page.locator('[data-testid="import-processing"]')).toBeVisible();
  });

  test('should handle data clearing', async ({ page }) => {
    await page.goto('/dashboard/data');
    
    // Test clear data section
    await expect(page.locator('[data-testid="clear-data-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="clear-all-data"]')).toBeVisible();
    
    // Test confirmation dialog
    await page.click('[data-testid="clear-all-data"]');
    
    // Should show confirmation dialog
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-clear"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancel-clear"]')).toBeVisible();
    
    // Test cancel
    await page.click('[data-testid="cancel-clear"]');
    await expect(page.locator('[data-testid="confirm-dialog"]')).not.toBeVisible();
  });

  test('should display data statistics', async ({ page }) => {
    await page.goto('/dashboard/data');
    
    // Test data info cards
    await expect(page.locator('[data-testid="total-games"]')).toBeVisible();
    await expect(page.locator('[data-testid="date-range"]')).toBeVisible();
    await expect(page.locator('[data-testid="storage-usage"]')).toBeVisible();
    
    // Test actual values are shown
    const totalGames = await page.locator('[data-testid="total-games"] .value').textContent();
    expect(totalGames).toMatch(/\d+/);
    
    const dateRange = await page.locator('[data-testid="date-range"] .value').textContent();
    expect(dateRange).toBeTruthy();
  });
});

test.describe('Settings Configuration', () => {
  test('should save preference changes', async ({ page }) => {
    await page.goto('/dashboard/settings');
    
    // Test theme selection
    await page.selectOption('[data-testid="theme-selector"]', 'dark');
    
    // Should update immediately or show save indicator
    await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
    
    // Test time frame default
    await page.selectOption('[data-testid="default-timeframe"]', '30d');
    
    // Test notification settings
    await page.check('[data-testid="enable-notifications"]');
    
    // Settings should persist (refresh page to test)
    await page.reload();
    
    const themeValue = await page.locator('[data-testid="theme-selector"]').inputValue();
    expect(themeValue).toBe('dark');
    
    const timeframeValue = await page.locator('[data-testid="default-timeframe"]').inputValue();
    expect(timeframeValue).toBe('30d');
    
    const notificationChecked = await page.locator('[data-testid="enable-notifications"]').isChecked();
    expect(notificationChecked).toBe(true);
  });

  test('should handle privacy settings', async ({ page }) => {
    await page.goto('/dashboard/settings');
    
    // Test privacy options
    await expect(page.locator('[data-testid="privacy-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-sharing"]')).toBeVisible();
    await expect(page.locator('[data-testid="anonymous-stats"]')).toBeVisible();
    
    // Test toggle privacy settings
    await page.uncheck('[data-testid="data-sharing"]');
    await page.check('[data-testid="anonymous-stats"]');
    
    // Should save automatically
    await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
  });
});

test.describe('Performance Requirements', () => {
  test('should load dashboard quickly', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    
    // Wait for main content to be visible
    await expect(page.locator('[data-testid="overview-content"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Should load in under 1.5 seconds
    expect(loadTime).toBeLessThan(1500);
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    // Add large dataset
    await page.addInitScript(() => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        date: new Date(Date.now() - (1000 - i) * 24 * 60 * 60 * 1000).toISOString(),
        guesses: Math.floor(Math.random() * 6) + 1,
        won: Math.random() > 0.15,
        hardMode: Math.random() > 0.7,
        word: `WORD${i + 1}`
      }));
      
      window.localStorage.setItem('wordle-games', JSON.stringify(largeDataset));
    });
    
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    
    // Should still load efficiently with large dataset
    await expect(page.locator('[data-testid="overview-content"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000); // Allow more time for large dataset
    
    // Charts should render without significant delay
    await page.click('[href="/analytics"]');
    await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible();
    
    // Time period changes should be responsive
    await page.selectOption('[data-testid="time-period-selector"]', '90d');
    
    // Should update within reasonable time
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible();
  });
});