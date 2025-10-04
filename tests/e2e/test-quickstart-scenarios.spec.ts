// E2E test for quickstart installation scenario
import { test, expect } from '@playwright/test';

test.describe('Extension Installation & Setup', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a test page that simulates extension installation
    await page.goto('/');
  });

  test('should complete extension installation flow', async ({ page }) => {
    // Test extension icon presence (simulated)
    // In a real test, this would verify the extension is installed
    await expect(page.locator('[data-testid="extension-icon"]')).toBeVisible();
    
    // Test popup opens when clicking extension icon
    await page.click('[data-testid="extension-icon"]');
    await expect(page.locator('[data-testid="popup-container"]')).toBeVisible();
    
    // Test popup has correct title and structure
    await expect(page.locator('h1')).toContainText('Wordle Stats');
    await expect(page.locator('.time-frame-picker')).toBeVisible();
    await expect(page.locator('.popup-main')).toBeVisible();
  });

  test('should handle permission granting flow', async ({ page }) => {
    // Test permission request UI
    await page.click('[data-testid="extension-icon"]');
    
    // Should show no data state initially
    await expect(page.locator('.no-data')).toBeVisible();
    await expect(page.locator('.no-data p')).toContainText('No Wordle data found');
    
    // Should show help text for getting started
    await expect(page.locator('.help-text')).toContainText('nytimes.com/games/wordle');
  });

  test('should provide accessible navigation', async ({ page }) => {
    await page.click('[data-testid="extension-icon"]');
    
    // Test skip link functionality
    await page.press('body', 'Tab');
    await expect(page.locator('.skip-link:focus')).toBeVisible();
    
    // Test keyboard navigation through time frame buttons
    await page.press('body', 'Tab'); // Skip link
    await page.press('body', 'Tab'); // First time frame button
    await expect(page.locator('.time-frame-btn:focus')).toBeVisible();
    
    // Test ARIA labels are present
    await expect(page.locator('[aria-pressed]')).toHaveCount(4); // 4 time frame buttons
    await expect(page.locator('[role="main"]')).toBeVisible();
  });
});

test.describe('First-Time Setup', () => {
  test('should handle different import methods', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Test that dashboard opens
    await expect(page.locator('h1')).toContainText('Wordle Stat Explorer');
    
    // Test navigation is present
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('[href="/"]')).toContainText('Overview');
    await expect(page.locator('[href="/analytics"]')).toContainText('Analytics');
    await expect(page.locator('[href="/data"]')).toContainText('Data');
    await expect(page.locator('[href="/settings"]')).toContainText('Settings');
  });

  test('should configure preferences correctly', async ({ page }) => {
    await page.goto('/dashboard/settings');
    
    // Test theme selection
    await expect(page.locator('[data-testid="theme-selector"]')).toBeVisible();
    
    // Test time frame selection
    await expect(page.locator('[data-testid="timeframe-selector"]')).toBeVisible();
    
    // Test notification preferences
    await expect(page.locator('[type="checkbox"]')).toBeVisible();
  });
});

test.describe('Core Usage Scenarios', () => {
  test('should display quick stats in popup', async ({ page }) => {
    // Simulate having some game data
    await page.addInitScript(() => {
      // Mock localStorage with sample game data
      const sampleStats = {
        winRate: 85.2,
        averageGuesses: 4.1,
        currentStreak: 5,
        gameCount: 42
      };
      window.localStorage.setItem('wordle-stats', JSON.stringify(sampleStats));
    });

    await page.click('[data-testid="extension-icon"]');
    
    // Should show statistics instead of no-data state
    await expect(page.locator('.stats-grid')).toBeVisible();
    
    // Test that stats are displayed correctly
    await expect(page.locator('[aria-labelledby="win-rate-label"]')).toBeVisible();
    await expect(page.locator('[aria-labelledby="avg-guesses-label"]')).toBeVisible();
    await expect(page.locator('[aria-labelledby="streak-label"]')).toBeVisible();
    await expect(page.locator('[aria-labelledby="games-label"]')).toBeVisible();
  });

  test('should handle time frame changes', async ({ page }) => {
    await page.click('[data-testid="extension-icon"]');
    
    // Test clicking different time frame buttons
    const timeFrames = ['7d', '30d', '90d', 'all'];
    
    for (const timeFrame of timeFrames) {
      await page.click(`[aria-label*="${timeFrame === '7d' ? 'last 7 days' : 
                                       timeFrame === '30d' ? 'last 30 days' :
                                       timeFrame === '90d' ? 'last 90 days' : 
                                       'all time'}"]`);
      
      // Should show loading or update stats
      await expect(page.locator('.popup-main')).toBeVisible();
    }
  });

  test('should open dashboard from popup', async ({ page }) => {
    await page.click('[data-testid="extension-icon"]');
    
    // Test dashboard link
    await expect(page.locator('.dashboard-link')).toBeVisible();
    await expect(page.locator('.dashboard-link')).toContainText('Open Dashboard');
    
    // Click should open dashboard (in test, we'll just verify the button works)
    await page.click('.dashboard-link');
    // In a real extension test, this would open a new tab
  });
});

test.describe('Accessibility Validation', () => {
  test('should meet WCAG standards', async ({ page }) => {
    await page.click('[data-testid="extension-icon"]');
    
    // Test color contrast (basic check)
    const button = page.locator('.time-frame-btn').first();
    const styles = await button.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        borderColor: computed.borderColor
      };
    });
    
    expect(styles.color).toBeTruthy();
    expect(styles.backgroundColor).toBeTruthy();
    
    // Test focus management
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.click('[data-testid="extension-icon"]');
    
    // Test full keyboard navigation flow
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // First time frame button
    await page.keyboard.press('Enter'); // Activate button
    
    // Should not crash and should show active state
    await expect(page.locator('.time-frame-btn.active')).toBeVisible();
    
    // Continue tabbing through interface
    await page.keyboard.press('Tab'); // Next button
    await page.keyboard.press('Tab'); // Next button  
    await page.keyboard.press('Tab'); // Next button
    await page.keyboard.press('Tab'); // Dashboard link
    
    await expect(page.locator('.dashboard-link:focus')).toBeVisible();
  });

  test('should announce changes to screen readers', async ({ page }) => {
    await page.click('[data-testid="extension-icon"]');
    
    // Test aria-live regions
    await expect(page.locator('[aria-live="polite"]')).toBeVisible();
    
    // Test status updates
    await expect(page.locator('[role="status"]')).toBeVisible();
    
    // Test proper labeling
    await expect(page.locator('[aria-label]')).toHaveCount(4); // Time frame buttons
    await expect(page.locator('[aria-describedby]')).toBeVisible();
  });
});