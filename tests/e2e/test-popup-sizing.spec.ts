import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Popup Sizing Verification', () => {
  test('verify popup fits without scrollbars', async ({ page }) => {
    // Load the popup HTML directly
    const popupHtmlPath = path.resolve(process.cwd(), 'dist/popup.html');
    await page.goto(`file:///${popupHtmlPath.replace(/\\/g, '/')}`);
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for any dynamic content to load
    await page.waitForTimeout(1000);

    // Measure body dimensions
    const bodyBox = await page.locator('body').boundingBox();
    console.log('Body dimensions:', bodyBox);

    // Check for scrollbars
    const hasVerticalScrollbar = await page.evaluate(() => {
      return document.body.scrollHeight > document.body.clientHeight;
    });
    
    const hasHorizontalScrollbar = await page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth;
    });

    console.log('Has vertical scrollbar:', hasVerticalScrollbar);
    console.log('Has horizontal scrollbar:', hasHorizontalScrollbar);

    // Get scroll dimensions
    const scrollInfo = await page.evaluate(() => ({
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.body.clientHeight,
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
      offsetHeight: document.body.offsetHeight,
      offsetWidth: document.body.offsetWidth
    }));
    
    console.log('Scroll info:', scrollInfo);

    // Check popup container dimensions
    const containerBox = await page.locator('.popup-container').boundingBox();
    console.log('Container dimensions:', containerBox);

    // Take screenshot
    await page.screenshot({ path: 'artifacts/popup-sizing-check.png', fullPage: true });

    // Verify no scrollbars
    expect(hasVerticalScrollbar).toBe(false);
    expect(hasHorizontalScrollbar).toBe(false);
    
    // Verify reasonable dimensions
    expect(bodyBox?.width).toBe(380);
    expect(bodyBox?.height).toBeLessThanOrEqual(600);
  });
});