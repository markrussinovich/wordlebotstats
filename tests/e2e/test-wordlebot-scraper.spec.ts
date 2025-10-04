import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('WordleBot Scraper Tests', () => {
  const syntheticPagePath = `file://${path.resolve(__dirname, '../fixtures/synthetic-wordlebot.html').replace(/\\/g, '/')}`;
  
  test('should load synthetic WordleBot page', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    // Verify page loaded
    await expect(page.locator('h1')).toHaveText('Your WordleBot History');
    
    // Verify game cards present
    const gameCards = await page.locator('.rating-container.svelte-pnoxcy').count();
    expect(gameCards).toBeGreaterThanOrEqual(5);
    
    console.log(`✓ Found ${gameCards} game cards on page`);
  });
  
  test('should extract game data from cards', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    // Check first game card content
    const firstCard = page.locator('.rating-container.svelte-pnoxcy').first();
    const cardText = await firstCard.textContent();
    
    // Should contain solution
    expect(cardText).toContain('CRANE');
    
    // Should contain scores
    expect(cardText).toContain('89'); // skill score
    expect(cardText).toContain('58'); // luck score
    
    // Should contain game number
    expect(cardText).toContain('#1194');
    
    // Should contain date
    expect(cardText).toContain('September 30');
    
    console.log('✓ Game card contains expected data');
  });
  
  test('should verify all games are visible', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    const totalCount = await page.locator('.rating-container.svelte-pnoxcy').count();
    console.log(`Total game count: ${totalCount}`);
    
    // Should have all 13 games visible
    expect(totalCount).toBe(13);
    
    console.log('✓ All games visible on page');
  });
  
  test('should manually extract game data from DOM', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    // Extract data directly using DOM APIs (simulating what scraper does)
    const extractedGames = await page.evaluate(() => {
      const gameCards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      const games: Array<{
        solution: string;
        gameNumber: number;
        skillScore: number;
        luckScore: number;
        steps: number;
        won: boolean;
        date: string;
      }> = [];
      
      gameCards.forEach(card => {
        const text = card.textContent || '';
        
        // Extract solution (e.g., "CRANE" or "The answer is CRANE")
        const solutionMatch = text.match(/(?:answer is\s+)?([A-Z]{5})/);
        const solution = solutionMatch ? solutionMatch[1] : '';
        
        // Extract game number (e.g., "#1194" or "Wordle #1194")
        const gameNumMatch = text.match(/#(\d+)/);
        const gameNumber = gameNumMatch ? parseInt(gameNumMatch[1]) : 0;
        
        // Extract skill score (e.g., "Your score was: 89" or "Skill: 89")
        const skillMatch = text.match(/(?:Your score was|Skill):\s*(\d+)/);
        const skillScore = skillMatch ? parseInt(skillMatch[1]) : 0;
        
        // Extract luck score (e.g., "Your luck was: 58" or "Luck: 58")
        const luckMatch = text.match(/(?:Your luck was|Luck):\s*(\d+)/);
        const luckScore = luckMatch ? parseInt(luckMatch[1]) : 0;
        
        // Extract steps (e.g., "3 guesses" or "X guesses")
        const stepsMatch = text.match(/([X\d]+)\s+guess/);
        const stepsStr = stepsMatch ? stepsMatch[1] : '0';
        const steps = stepsStr === 'X' ? 0 : parseInt(stepsStr);
        const won = stepsStr !== 'X';
        
        // Extract date (e.g., "September 30, 2025")
        const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d+),?\s+(\d{4})/);
        let date = '';
        if (dateMatch) {
          const months: Record<string, string> = {
            January: '01', February: '02', March: '03', April: '04',
            May: '05', June: '06', July: '07', August: '08',
            September: '09', October: '10', November: '11', December: '12'
          };
          const month = months[dateMatch[1]];
          const day = dateMatch[2].padStart(2, '0');
          const year = dateMatch[3];
          date = `${year}-${month}-${day}`;
        }
        
        if (solution && gameNumber) {
          games.push({ solution, gameNumber, skillScore, luckScore, steps, won, date });
        }
      });
      
      return games;
    });
    
    console.log(`✓ Extracted ${extractedGames.length} games`);
    expect(extractedGames.length).toBeGreaterThanOrEqual(5);
    
    // Verify first game data
    const firstGame = extractedGames[0];
    expect(firstGame.solution).toBe('CRANE');
    expect(firstGame.gameNumber).toBe(1194);
    expect(firstGame.skillScore).toBe(89);
    expect(firstGame.luckScore).toBe(58);
    expect(firstGame.steps).toBe(3);
    expect(firstGame.won).toBe(true);
    expect(firstGame.date).toBe('2025-09-30');
    
    console.log('✓ First game data correct:', firstGame);
  });
  
  test('should extract all games and validate data', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    // Extract all games
    const allGames = await page.evaluate(() => {
      const gameCards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      const games: Array<{
        gameNumber: number;
        solution: string;
        won: boolean;
        steps: number;
      }> = [];
      
      gameCards.forEach(card => {
        const text = card.textContent || '';
        const solutionMatch = text.match(/(?:answer is\s+)?([A-Z]{5})/);
        const gameNumMatch = text.match(/#(\d+)/);
        const stepsMatch = text.match(/([X\d]+)\s+guess/);
        
        if (solutionMatch && gameNumMatch) {
          const stepsStr = stepsMatch ? stepsMatch[1] : '0';
          games.push({
            gameNumber: parseInt(gameNumMatch[1]),
            solution: solutionMatch[1],
            won: stepsStr !== 'X',
            steps: stepsStr === 'X' ? 0 : parseInt(stepsStr)
          });
        }
      });
      
      return games;
    });
    
    console.log(`✓ Scraped ${allGames.length} games total`);
    expect(allGames.length).toBe(13);
    
    // Verify failed game exists and is parsed correctly
    const failedGame = allGames.find((g: { won: boolean }) => g.won === false);
    expect(failedGame).toBeDefined();
    expect(failedGame?.steps).toBe(0);
    console.log('✓ Failed game handled correctly:', failedGame);
    
    // Verify all games have valid data
    allGames.forEach((game: { solution: string; gameNumber: number }) => {
      expect(game.solution).toMatch(/^[A-Z]{5}$/);
      expect(game.gameNumber).toBeGreaterThan(0);
    });
    
    console.log('✓ All games have valid data');
  });
});
