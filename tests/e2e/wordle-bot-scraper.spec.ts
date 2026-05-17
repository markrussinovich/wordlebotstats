import { test, expect } from '@playwright/test';

test.describe('Wordle Bot Scraper', () => {
  test('should extract game data correctly from WordleBot page', async ({ page }) => {
    // Navigate to the WordleBot page
    // Note: This requires being logged in to NYTimes
    await page.goto('https://www.nytimes.com/interactive/2022/upshot/wordle-bot');
    
    // Wait for the page to load
    await page.waitForTimeout(3000);
    
    // Try to find and click the "Compare and view your recent scores" button if present
    const compareButton = page.locator('text=/compare.*recent.*scores/i').first();
    if (await compareButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await compareButton.click();
      await page.waitForTimeout(2000);
      
      // Navigate to game history (click right arrow twice or third dot)
      const slideDots = page.locator('.slide-dot');
      const dotCount = await slideDots.count();
      if (dotCount >= 3) {
        await slideDots.nth(2).click();
        await page.waitForTimeout(1500);
      }
    }
    
    // Wait for game cards to be visible
    await page.waitForSelector('.rating-container.svelte-pnoxcy', { timeout: 10000 });
    
    // Get all game cards
    const cards = page.locator('.rating-container.svelte-pnoxcy');
    const cardCount = await cards.count();
    
    console.log(`Found ${cardCount} game cards`);
    expect(cardCount).toBeGreaterThan(0);
    
    // Test extraction on the first few cards
    for (let i = 0; i < Math.min(5, cardCount); i++) {
      const card = cards.nth(i);
      
      // Extract solution
      const solutionEl = card.locator('strong.solution');
      const solution = await solutionEl.textContent();
      
      // Extract date
      const dateEl = card.locator('span.date-label');
      const dateText = await dateEl.textContent();
      
      // Extract skill, luck, steps
      const ratingRight = card.locator('.rating-right');
      const numValues = ratingRight.locator('.rating-value.num span.num');
      const numCount = await numValues.count();
      
      const skill = await numValues.nth(0).textContent();
      const luck = await numValues.nth(1).textContent();
      const steps = numCount >= 3 ? await numValues.nth(2).textContent() : null;
      
      console.log(`\n=== Game ${i + 1} ===`);
      console.log(`Solution: ${solution}`);
      console.log(`Date: ${dateText}`);
      console.log(`Skill: ${skill}`);
      console.log(`Luck: ${luck}`);
      console.log(`Steps: ${steps}`);
      console.log(`Won: ${steps !== '-' && steps !== '—' && steps !== '–'}`);
      
      // Assertions
      expect(solution).toBeTruthy();
      expect(solution?.trim().length).toBe(5);
      expect(dateText).toMatch(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/);
      expect(skill).toMatch(/^\d+$/);
      expect(luck).toMatch(/^\d+$/);
      if (steps) {
        expect(steps).toMatch(/^(\d+|[-—–])$/);
      }
    }
  });
  
  test('should correctly identify lost games with dash', async ({ page }) => {
    await page.goto('https://www.nytimes.com/interactive/2022/upshot/wordle-bot');
    await page.waitForTimeout(3000);
    
    // Navigate to game history
    const compareButton = page.locator('text=/compare.*recent.*scores/i').first();
    if (await compareButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await compareButton.click();
      await page.waitForTimeout(2000);
      
      const slideDots = page.locator('.slide-dot');
      if (await slideDots.count() >= 3) {
        await slideDots.nth(2).click();
        await page.waitForTimeout(1500);
      }
    }
    
    await page.waitForSelector('.rating-container.svelte-pnoxcy', { timeout: 10000 });
    
    // Find games with dash in steps
    const cards = page.locator('.rating-container.svelte-pnoxcy');
    const cardCount = await cards.count();
    
    let foundLostGame = false;
    
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const ratingRight = card.locator('.rating-right');
      const numValues = ratingRight.locator('.rating-value.num span.num');
      const numCount = await numValues.count();
      
      if (numCount >= 3) {
        const steps = await numValues.nth(2).textContent();
        if (steps === '-' || steps === '—' || steps === '–') {
          foundLostGame = true;
          
          const solution = await card.locator('strong.solution').textContent();
          const dateText = await card.locator('span.date-label').textContent();
          const skill = await numValues.nth(0).textContent();
          const luck = await numValues.nth(1).textContent();
          
          console.log(`\nFound LOST game:`);
          console.log(`Solution: ${solution}`);
          console.log(`Date: ${dateText}`);
          console.log(`Skill: ${skill}`);
          console.log(`Luck: ${luck}`);
          console.log(`Steps: ${steps} (LOST)`);
          
          // Verify it's properly identified as lost
          expect(steps).toMatch(/^[-—–]$/);
          break;
        }
      }
    }
    
    if (foundLostGame) {
      console.log('\n✓ Successfully found and identified a lost game');
    } else {
      console.log('\n⚠ No lost games found in the visible cards');
    }
  });
  
  test('should extract correct date-word associations', async ({ page }) => {
    await page.goto('https://www.nytimes.com/interactive/2022/upshot/wordle-bot');
    await page.waitForTimeout(3000);
    
    // Navigate to game history
    const compareButton = page.locator('text=/compare.*recent.*scores/i').first();
    if (await compareButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await compareButton.click();
      await page.waitForTimeout(2000);
      
      const slideDots = page.locator('.slide-dot');
      if (await slideDots.count() >= 3) {
        await slideDots.nth(2).click();
        await page.waitForTimeout(1500);
      }
    }
    
    await page.waitForSelector('.rating-container.svelte-pnoxcy', { timeout: 10000 });
    
    // Extract multiple games and verify date/word associations
    const cards = page.locator('.rating-container.svelte-pnoxcy');
    const cardCount = await cards.count();
    
    const games: Array<{solution: string | null, date: string | null}> = [];
    
    for (let i = 0; i < Math.min(10, cardCount); i++) {
      const card = cards.nth(i);
      const solution = await card.locator('strong.solution').textContent();
      const dateText = await card.locator('span.date-label').textContent();
      
      games.push({ solution, date: dateText });
      console.log(`Game ${i + 1}: ${dateText?.trim()} - ${solution?.trim()?.toUpperCase()}`);
    }
    
    // Verify each card has both solution and date
    games.forEach((game, index) => {
      expect(game.solution, `Game ${index + 1} should have a solution`).toBeTruthy();
      expect(game.date, `Game ${index + 1} should have a date`).toBeTruthy();
    });
    
    // Verify no duplicate dates (each date should have a unique word)
    const dateWordMap = new Map<string, string>();
    games.forEach((game, index) => {
      if (game.date && game.solution) {
        const trimmedDate = game.date.trim();
        const trimmedSolution = game.solution.trim().toUpperCase();
        
        if (dateWordMap.has(trimmedDate)) {
          const existingSolution = dateWordMap.get(trimmedDate);
          if (existingSolution !== trimmedSolution) {
            console.error(`\n❌ Date mismatch detected!`);
            console.error(`Date "${trimmedDate}" maps to both "${existingSolution}" and "${trimmedSolution}"`);
            throw new Error(`Date-word association mismatch at game ${index + 1}`);
          }
        } else {
          dateWordMap.set(trimmedDate, trimmedSolution);
        }
      }
    });
    
    console.log(`\n✓ All ${games.length} games have correct date-word associations`);
  });
});
