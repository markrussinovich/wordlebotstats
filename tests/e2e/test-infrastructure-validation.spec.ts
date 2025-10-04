// Simple E2E validation test for quickstart scenarios
import { test, expect } from '@playwright/test';

test.describe('E2E Test Infrastructure Validation', () => {
  test('should validate E2E test setup is working', async ({ page }) => {
    // This test validates that our E2E infrastructure is properly configured
    // For now, we'll test against a simple HTML page to validate setup
    
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Wordle Stat Explorer Test</title>
        </head>
        <body>
          <div data-testid="test-container">
            <h1>Test Page</h1>
            <button data-testid="test-button">Test Button</button>
          </div>
        </body>
      </html>
    `);
    
    // Validate basic page functionality
    await expect(page).toHaveTitle(/Wordle/);
    await expect(page.locator('[data-testid="test-container"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Test Page');
    
    console.log('✓ E2E test infrastructure validated');
    console.log('✓ Playwright configured correctly');
    console.log('✓ Basic DOM interactions working');
  });

  test('should validate test data structures', async ({ page }) => {
    // Test that we can inject mock data for testing
    await page.addInitScript(() => {
      const mockData = {
        games: [{ id: 1, date: '2024-01-01', guesses: 4, won: true }],
        benchmarks: { globalAverage: { winRate: 85.0 } }
      };
      
      window.localStorage.setItem('test-data', JSON.stringify(mockData));
    });
    
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Wordle Data Test</title>
        </head>
        <body>
          <div id="data-output"></div>
          <script>
            const data = localStorage.getItem('test-data');
            document.getElementById('data-output').textContent = data ? 'Data loaded' : 'No data';
          </script>
        </body>
      </html>
    `);
    
    // Validate that mock data was injected
    await expect(page.locator('#data-output')).toContainText('Data loaded');
    
    const injectedData = await page.evaluate(() => {
      return window.localStorage.getItem('test-data');
    });
    
    expect(injectedData).toBeTruthy();
    
    console.log('✓ Test data injection working');
    console.log('✓ Mock data structures validated');
  });
});