// E2E test for performance benchmarking scenarios
import { test, expect } from '@playwright/test';

test.describe('Performance Benchmarking', () => {
  test.beforeEach(async ({ page }) => {
    // Add realistic data for performance testing
    await page.addInitScript(() => {
      const mockGames = Array.from({ length: 500 }, (_, i) => ({
        id: i + 1,
        date: new Date(Date.now() - (500 - i) * 24 * 60 * 60 * 1000).toISOString(),
        guesses: Math.floor(Math.random() * 6) + 1,
        won: Math.random() > 0.15,
        hardMode: Math.random() > 0.7,
        word: `WORD${i.toString().padStart(3, '0')}`
      }));
      
      window.localStorage.setItem('wordle-games', JSON.stringify(mockGames));
    });
  });

  test('popup should load in under 500ms', async ({ page }) => {
    // Navigate to a page that simulates having the extension
    await page.goto('/');
    
    const startTime = Date.now();
    
    // Simulate clicking extension icon and measuring popup load
    await page.click('[data-testid="extension-icon"]');
    
    // Wait for popup content to be fully loaded
    await expect(page.locator('.popup-main')).toBeVisible();
    await expect(page.locator('.stats-grid')).toBeVisible();
    await expect(page.locator('.time-frame-picker')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Should load in under 500ms as specified in requirements
    expect(loadTime).toBeLessThan(500);
    
    console.log(`Popup load time: ${loadTime}ms`);
  });

  test('dashboard should load in under 1.5s', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    
    // Wait for all main dashboard elements to load
    await expect(page.locator('h1')).toContainText('Wordle Stat Explorer');
    await expect(page.locator('[data-testid="overview-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-card"]')).toHaveCount(4);
    await expect(page.locator('nav')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Should load in under 1.5s as specified in requirements
    expect(loadTime).toBeLessThan(1500);
    
    console.log(`Dashboard load time: ${loadTime}ms`);
  });

  test('chart rendering should be performant', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    
    const startTime = Date.now();
    
    // Wait for all charts to render
    await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="guess-distribution-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-chart"]')).toBeVisible();
    
    const renderTime = Date.now() - startTime;
    
    // Chart rendering should be reasonable (under 2s for all charts)
    expect(renderTime).toBeLessThan(2000);
    
    console.log(`Chart render time: ${renderTime}ms`);
  });

  test('time frame changes should be responsive', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Test popup time frame changes
    await page.click('[data-testid="extension-icon"]');
    
    const timeFrameTests = ['30d', '90d', 'all', '7d'];
    
    for (const timeFrame of timeFrameTests) {
      const startTime = Date.now();
      
      await page.click(`[aria-label*="${timeFrame === '7d' ? 'last 7 days' : 
                                       timeFrame === '30d' ? 'last 30 days' :
                                       timeFrame === '90d' ? 'last 90 days' : 
                                       'all time'}"]`);
      
      // Wait for stats to update
      await expect(page.locator('.stats-grid')).toBeVisible();
      
      const updateTime = Date.now() - startTime;
      
      // Time frame updates should be fast (under 200ms)
      expect(updateTime).toBeLessThan(200);
      
      console.log(`Time frame ${timeFrame} update: ${updateTime}ms`);
    }
  });

  test('large dataset handling performance', async ({ page }) => {
    // Add even larger dataset for stress testing
    await page.addInitScript(() => {
      const largeDataset = Array.from({ length: 2000 }, (_, i) => ({
        id: i + 1,
        date: new Date(Date.now() - (2000 - i) * 24 * 60 * 60 * 1000).toISOString(),
        guesses: Math.floor(Math.random() * 6) + 1,
        won: Math.random() > 0.15,
        hardMode: Math.random() > 0.7,
        word: `LARGE${i.toString().padStart(4, '0')}`
      }));
      
      window.localStorage.setItem('wordle-games', JSON.stringify(largeDataset));
    });
    
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    
    // Should still load reasonably fast with large dataset
    await expect(page.locator('[data-testid="overview-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-card"]')).toHaveCount(4);
    
    const loadTime = Date.now() - startTime;
    
    // Allow more time for large dataset but should still be reasonable
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`Large dataset (2000 games) load time: ${loadTime}ms`);
    
    // Test chart performance with large dataset
    const chartStartTime = Date.now();
    
    await page.click('[href="/analytics"]');
    await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible();
    
    const chartLoadTime = Date.now() - chartStartTime;
    
    // Charts should still render in reasonable time
    expect(chartLoadTime).toBeLessThan(4000);
    
    console.log(`Large dataset chart render time: ${chartLoadTime}ms`);
  });

  test('memory usage should be reasonable', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Get initial memory usage
    const initialMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });
    
    // Navigate through different pages and load data
    await page.click('[href="/analytics"]');
    await expect(page.locator('[data-testid="analytics-content"]')).toBeVisible();
    
    await page.click('[href="/data"]');
    await expect(page.locator('[data-testid="data-management-content"]')).toBeVisible();
    
    await page.click('[href="/settings"]');
    await expect(page.locator('[data-testid="settings-content"]')).toBeVisible();
    
    await page.click('[href="/"]');
    await expect(page.locator('[data-testid="overview-content"]')).toBeVisible();
    
    // Get final memory usage
    const finalMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });
    
    if (initialMetrics && finalMetrics) {
      const memoryIncrease = finalMetrics.usedJSHeapSize - initialMetrics.usedJSHeapSize;
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory increase should be reasonable (under 10MB for typical usage)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    }
  });

  test('concurrent operations performance', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Test multiple concurrent operations
    const operations = [
      () => page.click('[href="/analytics"]'),
      () => page.selectOption('[data-testid="time-period-selector"]', '90d'),
      () => page.click('[href="/data"]'),
      () => page.click('[data-testid="refresh-benchmarks"]')
    ];
    
    const startTime = Date.now();
    
    // Execute operations concurrently where possible
    await Promise.all([
      operations[0](),
      page.waitForTimeout(100).then(async () => { await operations[1](); }),
      page.waitForTimeout(200).then(async () => { await operations[2](); }),
      page.waitForTimeout(300).then(async () => { await operations[3](); })
    ]);
    
    // Wait for all operations to complete
    await expect(page.locator('[data-testid="data-management-content"]')).toBeVisible();
    
    const totalTime = Date.now() - startTime;
    
    // Concurrent operations should complete in reasonable time
    expect(totalTime).toBeLessThan(2000);
    
    console.log(`Concurrent operations completed in: ${totalTime}ms`);
  });

  test('bundle size impact measurement', async ({ page }) => {
    // Measure network performance  
    const client = await page.context().newCDPSession(page);
    
    await client.send('Performance.enable');
    await client.send('Network.enable');
    
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    
    // Wait for page to fully load
    await expect(page.locator('[data-testid="overview-content"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Get performance metrics
    const metrics = await client.send('Performance.getMetrics');
    
    console.log('Performance metrics:', metrics.metrics.map(m => `${m.name}: ${m.value}`));
    
    // Total load time should meet requirements
    expect(loadTime).toBeLessThan(1500);
    
    await client.detach();
  });
});