/**
 * Simple WordleBot scraper test - launches fresh Edge and lets you login manually
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function testWordleBotSimple() {
  console.log('🚀 Starting simple WordleBot test...\n');
  
  let browser;
  
  try {
    console.log('⏳ Launching fresh Edge browser...');
    
    // Launch a fresh Edge browser
    browser = await chromium.launch({
      channel: 'msedge',
      headless: false,
      slowMo: 500,
      args: ['--no-sandbox'] // Minimal args to avoid conflicts
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    console.log('✅ Browser launched successfully');
    console.log('🔄 Navigating to WordleBot page...');
    
    await page.goto('https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('📄 Page loaded. Title:', await page.title());
    
    // Check if we need to login
    console.log('🔍 Checking if login is required...');
    
    const needsLogin = await page.evaluate(() => {
      // Look for login indicators
      const loginButton = document.querySelector('a[href*="login"], button[data-testid*="log"], [aria-label*="log in"]');
      const subscribeButton = document.querySelector('a[href*="subscribe"]');
      const accountMenu = document.querySelector('[data-testid="account-menu"], .user-menu');
      
      // Check if we see content or a paywall
      const hasGameContent = document.querySelector('#g-wordle-results, [class*="wordle"], [class*="results"]');
      const hasPaywall = document.querySelector('[class*="paywall"], [class*="subscribe"], [data-testid*="paywall"]');
      
      return {
        hasLoginButton: !!loginButton,
        hasSubscribeButton: !!subscribeButton,
        hasAccountMenu: !!accountMenu,
        hasGameContent: !!hasGameContent,
        hasPaywall: !!hasPaywall,
        url: window.location.href,
        bodyText: document.body.textContent.slice(0, 500)
      };
    });
    
    console.log('Login check results:', {
      needsLogin: needsLogin.hasLoginButton || needsLogin.hasPaywall,
      hasContent: needsLogin.hasGameContent,
      url: needsLogin.url
    });
    
    if (needsLogin.hasLoginButton || needsLogin.hasPaywall || !needsLogin.hasGameContent) {
      console.log('\n⚠️  LOGIN REQUIRED');
      console.log('Please log in to your NYTimes account in the browser window.');
      console.log('After logging in and seeing your Wordle history, press Enter to continue...\n');
      
      // Wait for user to login manually
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      await new Promise(resolve => {
        rl.question('Press Enter when you can see your Wordle game history...', () => {
          rl.close();
          resolve();
        });
      });
      
      console.log('✅ Continuing with test...');
    }
    
    // Now test the scraper
    console.log('\n💉 Testing WordleBot scraper functionality...');
    
    const testResults = await page.evaluate(async () => {
      const results = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        tests: [],
        debug: {}
      };
      
      // Debug: Get page info
      results.debug.title = document.title;
      results.debug.bodyStart = document.body.textContent.slice(0, 300);
      
      // Test 1: Find main container
      console.log('Testing main container...');
      const container = document.querySelector('#g-wordle-results');
      results.tests.push({
        test: 'Main container (#g-wordle-results)',
        passed: !!container,
        details: container ? 'Found' : 'Not found'
      });
      
      if (!container) {
        // Try alternative containers
        const altSelectors = [
          '[class*="wordle-results"]',
          '[class*="results"]',
          '[id*="wordle"]',
          'main',
          '[role="main"]'
        ];
        
        for (const selector of altSelectors) {
          const alt = document.querySelector(selector);
          if (alt && alt.textContent.toLowerCase().includes('wordle')) {
            results.tests.push({
              test: `Alternative container (${selector})`,
              passed: true,
              details: `Found - contains "wordle" text`
            });
            break;
          }
        }
      }
      
      // Test 2: Look for game cards with multiple strategies
      console.log('Testing game card detection...');
      
      const strategies = [
        {
          name: 'Original selector (.rating-container.svelte-pnoxcy)',
          selector: '.rating-container.svelte-pnoxcy'
        },
        {
          name: 'Generic rating container',
          selector: '.rating-container'
        },
        {
          name: 'Any rating class',
          selector: '[class*="rating"]'
        },
        {
          name: 'Svelte components',
          selector: '[class*="svelte"]'
        }
      ];
      
      let bestStrategy = null;
      let gameCards = [];
      
      for (const strategy of strategies) {
        const elements = document.querySelectorAll(strategy.selector);
        const gameElements = Array.from(elements).filter(el => {
          const text = el.textContent.toLowerCase();
          return (text.includes('skill') && text.includes('luck')) || 
                 (text.includes('solution') && text.includes('was')) ||
                 /\\b[a-z]{5}\\b/i.test(text);
        });
        
        if (gameElements.length > gameCards.length) {
          bestStrategy = strategy;
          gameCards = gameElements;
        }
        
        results.tests.push({
          test: strategy.name,
          passed: gameElements.length > 0,
          details: `Found ${gameElements.length} potential game cards`
        });
      }
      
      // Test 3: Look for pagination button
      console.log('Testing pagination button...');
      
      const buttonStrategies = [
        '.show-more-button.svelte-151vgtd',
        '.show-more-button',
        '[class*="show-more"]',
        '[class*="load-more"]'
      ];
      
      let showMoreBtn = null;
      
      for (const selector of buttonStrategies) {
        const btn = document.querySelector(selector);
        if (btn) {
          showMoreBtn = btn;
          results.tests.push({
            test: `Pagination button (${selector})`,
            passed: true,
            details: `Found - text: "${btn.textContent.trim()}"`
          });
          break;
        }
      }
      
      // Also search by text content
      if (!showMoreBtn) {
        const allButtons = document.querySelectorAll('button, [role="button"], div[onclick]');
        for (const btn of allButtons) {
          const text = btn.textContent.toLowerCase();
          if (text.includes('more') && (text.includes('wordle') || text.includes('show'))) {
            showMoreBtn = btn;
            results.tests.push({
              test: 'Pagination button (by text)',
              passed: true,
              details: `Found by text: "${btn.textContent.trim()}"`
            });
            break;
          }
        }
      }
      
      if (!showMoreBtn) {
        results.tests.push({
          test: 'Pagination button',
          passed: false,
          details: 'No pagination button found'
        });
      }
      
      // Test 4: Extract data from game cards
      if (gameCards.length > 0) {
        console.log('Testing data extraction...');
        
        const sampleGames = [];
        
        for (let i = 0; i < Math.min(3, gameCards.length); i++) {
          const card = gameCards[i];
          const text = card.textContent;
          const html = card.outerHTML.slice(0, 500);
          
          const game = {
            index: i,
            rawText: text.slice(0, 300),
            rawHtml: html
          };
          
          // Extract solution with multiple patterns
          const solutionPatterns = [
            /solution was:\\s*([a-z]{5})/i,
            /solution:\\s*([a-z]{5})/i,
            /answer was:\\s*([a-z]{5})/i,
            /word was:\\s*([a-z]{5})/i,
            /\\b([A-Z]{5})\\b/
          ];
          
          for (const pattern of solutionPatterns) {
            const match = text.match(pattern);
            if (match) {
              game.solution = match[1].toUpperCase();
              game.solutionPattern = pattern.toString();
              break;
            }
          }
          
          // Extract date
          const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2})/);
          if (dateMatch) {
            game.dateString = `${dateMatch[1]} ${dateMatch[2]}`;
          }
          
          // Extract skill score
          const skillPatterns = [
            /(?:Your score was|score was|skill)[:\\s]+(\\d{1,3})/i,
            /skill[:\\s]+(\\d{1,3})/i
          ];
          
          for (const pattern of skillPatterns) {
            const match = text.match(pattern);
            if (match) {
              game.skillScore = parseInt(match[1]);
              game.skillPattern = pattern.toString();
              break;
            }
          }
          
          // Extract luck score
          const luckPatterns = [
            /(?:Your luck was|luck was|luck)[:\\s]+(\\d{1,3})/i,
            /luck[:\\s]+(\\d{1,3})/i
          ];
          
          for (const pattern of luckPatterns) {
            const match = text.match(pattern);
            if (match) {
              game.luckScore = parseInt(match[1]);
              game.luckPattern = pattern.toString();
              break;
            }
          }
          
          // Extract steps
          const stepsPatterns = [
            /(?:It took you|took you)[:\\s]+(\\d+|X)/i,
            /steps?[:\\s]+(\\d+|X)/i,
            /(\\d+)\\s*guess/i
          ];
          
          for (const pattern of stepsPatterns) {
            const match = text.match(pattern);
            if (match) {
              const val = match[1];
              game.steps = val.toUpperCase() === 'X' ? 0 : parseInt(val);
              game.won = val.toUpperCase() !== 'X';
              game.stepsPattern = pattern.toString();
              break;
            }
          }
          
          sampleGames.push(game);
        }
        
        results.tests.push({
          test: 'Data extraction',
          passed: sampleGames.some(g => g.solution || g.skillScore),
          details: `Attempted extraction from ${sampleGames.length} cards`
        });
        
        results.sampleGames = sampleGames;
      }
      
      // Summary
      results.summary = {
        containerFound: !!container,
        gameCardsFound: gameCards.length,
        bestStrategy: bestStrategy?.name,
        paginationFound: !!showMoreBtn,
        dataExtractionWorking: results.sampleGames ? results.sampleGames.some(g => g.solution || g.skillScore) : false
      };
      
      return results;
    });
    
    // Display results
    console.log('\n📊 TEST RESULTS:');
    console.log('================');
    console.log(`Page: ${testResults.debug.title}`);
    console.log(`URL: ${testResults.url}\n`);
    
    testResults.tests.forEach((test, idx) => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${idx + 1}. ${status} ${test.test}`);
      console.log(`   ${test.details}\n`);
    });
    
    console.log('📋 SUMMARY:');
    console.log(`  Container found: ${testResults.summary.containerFound}`);
    console.log(`  Game cards found: ${testResults.summary.gameCardsFound}`);
    console.log(`  Best strategy: ${testResults.summary.bestStrategy}`);
    console.log(`  Pagination found: ${testResults.summary.paginationFound}`);
    console.log(`  Data extraction working: ${testResults.summary.dataExtractionWorking}\n`);
    
    if (testResults.sampleGames && testResults.sampleGames.length > 0) {
      console.log('🎮 SAMPLE EXTRACTED DATA:');
      testResults.sampleGames.forEach((game, idx) => {
        console.log(`  Game ${idx + 1}:`);
        console.log(`    Solution: ${game.solution || 'Not found'} ${game.solutionPattern ? `(${game.solutionPattern})` : ''}`);
        console.log(`    Date: ${game.dateString || 'Not found'}`);
        console.log(`    Skill: ${game.skillScore || 'Not found'} ${game.skillPattern ? `(${game.skillPattern})` : ''}`);
        console.log(`    Luck: ${game.luckScore || 'Not found'} ${game.luckPattern ? `(${game.luckPattern})` : ''}`);
        console.log(`    Steps: ${game.steps !== undefined ? game.steps : 'Not found'} ${game.stepsPattern ? `(${game.stepsPattern})` : ''}`);
        console.log(`    Won: ${game.won !== undefined ? game.won : 'Not found'}`);
        console.log(`    Raw text (first 100 chars): ${game.rawText.slice(0, 100)}...\n`);
      });
    }
    
    // Save results
    const resultsDir = 'test-results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsFile = path.join(resultsDir, 'wordle-bot-simple-test.json');
    fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
    console.log(`💾 Detailed results saved to: ${resultsFile}`);
    
    const passedTests = testResults.tests.filter(t => t.passed).length;
    console.log(`\n🎯 FINAL SCORE: ${passedTests}/${testResults.tests.length} tests passed`);
    
    if (testResults.summary.dataExtractionWorking) {
      console.log('🎉 SUCCESS! The scraper can extract data from the WordleBot page.');
    } else {
      console.log('⚠️  Data extraction needs work. Check the patterns and selectors.');
    }
    
    console.log('\n👀 Browser window left open for manual inspection.');
    console.log('   Check the page and press Ctrl+C when done.');
    
    // Keep browser open for inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testWordleBotSimple().catch(console.error);