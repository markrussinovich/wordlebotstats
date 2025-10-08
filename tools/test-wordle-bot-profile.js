/**
 * Test WordleBot scraper using Edge with existing user profile
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function testWordleBotWithProfile() {
  console.log('🚀 Starting WordleBot test with existing Edge profile...\n');
  
  let browser;
  
  try {
    // Use the default Edge user data directory
    const userDataDir = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data');
    
    console.log('📂 Using Edge profile from:', userDataDir);
    console.log('⏳ Launching Edge browser...');
    
    // Launch Edge with the existing user profile
    browser = await chromium.launchPersistentContext(userDataDir, {
      channel: 'msedge',
      headless: false,
      slowMo: 1000, // Slow down for visibility
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    console.log('✅ Edge browser launched with existing profile');
    
    // Create a new page
    const page = await browser.newPage();
    
    console.log('🔄 Navigating to WordleBot page...');
    await page.goto('https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('⏳ Waiting for page to load...');
    
    // Wait a bit for any dynamic content
    await page.waitForTimeout(3000);
    
    // Check if we're logged in by looking for account indicators
    console.log('🔍 Checking login status...');
    
    const loginCheck = await page.evaluate(() => {
      // Look for common NYTimes login indicators
      const accountButton = document.querySelector('[data-testid="account-menu"], .user-menu, [aria-label*="account"], [aria-label*="Account"]');
      const loginButton = document.querySelector('[data-testid="log-in"], .login-button, [href*="login"]');
      const subscribeButton = document.querySelector('[data-testid="subscribe"], [href*="subscribe"]');
      
      return {
        hasAccountButton: !!accountButton,
        hasLoginButton: !!loginButton,
        hasSubscribeButton: !!subscribeButton,
        url: window.location.href,
        title: document.title
      };
    });
    
    console.log('Login status check:', loginCheck);
    
    if (loginCheck.hasLoginButton) {
      console.log('⚠️  It appears you may not be logged in. Please log in manually in the browser window.');
      console.log('   After logging in, press Enter to continue...');
      
      // Wait for user input
      await new Promise(resolve => {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        readline.question('Press Enter when ready...', () => {
          readline.close();
          resolve();
        });
      });
    }
    
    // Now test the scraper
    console.log('💉 Testing WordleBot scraper...');
    
    const testResults = await page.evaluate(async () => {
      const results = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        pageTitle: document.title,
        tests: []
      };
      
      // Test 1: Find container
      const container = document.querySelector('#g-wordle-results');
      results.tests.push({
        test: 'Main container found',
        passed: !!container,
        details: container ? 'Found #g-wordle-results' : 'Container not found'
      });
      
      if (!container) {
        // Try alternative selectors
        const altContainers = [
          '[class*="wordle-results"]',
          '[class*="results"]',
          '[id*="wordle"]',
          '[id*="results"]'
        ];
        
        for (const selector of altContainers) {
          const alt = document.querySelector(selector);
          if (alt) {
            results.tests.push({
              test: 'Alternative container found',
              passed: true,
              details: `Found with selector: ${selector}`
            });
            break;
          }
        }
        
        return results;
      }
      
      // Test 2: Look for any game-related elements
      const gameSelectors = [
        '.rating-container.svelte-pnoxcy',
        '.rating-container',
        '[class*="rating"]',
        '[class*="game"]',
        '[class*="card"]'
      ];
      
      let gameCards = [];
      let workingSelector = null;
      
      for (const selector of gameSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // Filter for elements that look like game cards
          const filtered = Array.from(elements).filter(el => {
            const text = el.textContent.toLowerCase();
            return text.includes('skill') || text.includes('luck') || text.includes('wordle') || /\\b[a-z]{5}\\b/i.test(text);
          });
          
          if (filtered.length > gameCards.length) {
            gameCards = filtered;
            workingSelector = selector;
          }
        }
      }
      
      results.tests.push({
        test: 'Game cards found',
        passed: gameCards.length > 0,
        details: workingSelector ? `Found ${gameCards.length} cards with selector: ${workingSelector}` : 'No game cards found'
      });
      
      // Test 3: Look for pagination button
      const buttonSelectors = [
        '.show-more-button.svelte-151vgtd',
        '.show-more-button',
        '[class*="show-more"]',
        '[class*="load-more"]',
        'button:contains("more")',
        'button:contains("Show")'
      ];
      
      let showMoreBtn = null;
      let workingButtonSelector = null;
      
      for (const selector of buttonSelectors) {
        const btn = document.querySelector(selector);
        if (btn) {
          const text = btn.textContent.toLowerCase();
          if (text.includes('more') || text.includes('show') || text.includes('load')) {
            showMoreBtn = btn;
            workingButtonSelector = selector;
            break;
          }
        }
      }
      
      // Also look for buttons by text content
      if (!showMoreBtn) {
        const allButtons = document.querySelectorAll('button, [role="button"], div[onclick], div[click]');
        for (const btn of allButtons) {
          const text = btn.textContent.toLowerCase();
          if ((text.includes('more') && text.includes('wordle')) || 
              (text.includes('show') && text.includes('more')) ||
              text.includes('load more')) {
            showMoreBtn = btn;
            workingButtonSelector = 'text-based search';
            break;
          }
        }
      }
      
      results.tests.push({
        test: 'Show more button found',
        passed: !!showMoreBtn,
        details: showMoreBtn ? `Found with: ${workingButtonSelector}, text: "${showMoreBtn.textContent.trim()}"` : 'No pagination button found'
      });
      
      // Test 4: Extract sample data if we found game cards
      if (gameCards.length > 0) {
        const sampleGames = [];
        
        for (let i = 0; i < Math.min(3, gameCards.length); i++) {
          const card = gameCards[i];
          const text = card.textContent;
          const game = { index: i };
          
          // Try various patterns for solution
          const solutionPatterns = [
            /solution was:\\s*([a-z]{5})/i,
            /solution:\\s*([a-z]{5})/i,
            /word was:\\s*([a-z]{5})/i,
            /answer:\\s*([a-z]{5})/i,
            /\\b([A-Z]{5})\\b/
          ];
          
          for (const pattern of solutionPatterns) {
            const match = text.match(pattern);
            if (match) {
              game.solution = match[1].toUpperCase();
              break;
            }
          }
          
          // Try patterns for date
          const datePattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2})/;
          const dateMatch = text.match(datePattern);
          if (dateMatch) {
            game.dateString = `${dateMatch[1]} ${dateMatch[2]}`;
          }
          
          // Try patterns for scores
          const skillPatterns = [
            /(?:score was|skill)[:\\s]+(\\d{1,3})/i,
            /skill[:\\s]+(\\d{1,3})/i
          ];
          
          for (const pattern of skillPatterns) {
            const match = text.match(pattern);
            if (match) {
              game.skillScore = parseInt(match[1]);
              break;
            }
          }
          
          const luckPatterns = [
            /(?:luck was|luck)[:\\s]+(\\d{1,3})/i,
            /luck[:\\s]+(\\d{1,3})/i
          ];
          
          for (const pattern of luckPatterns) {
            const match = text.match(pattern);
            if (match) {
              game.luckScore = parseInt(match[1]);
              break;
            }
          }
          
          // Include raw text for analysis
          game.rawText = text.slice(0, 200);
          
          sampleGames.push(game);
        }
        
        results.tests.push({
          test: 'Data extraction from sample cards',
          passed: sampleGames.some(g => g.solution || g.skillScore),
          details: `Extracted data from ${sampleGames.length} cards`
        });
        
        results.sampleGames = sampleGames;
      }
      
      // Include page structure for debugging
      results.pageStructure = {
        hasContainer: !!container,
        totalElements: document.querySelectorAll('*').length,
        hasGameData: gameCards.length > 0,
        hasPagination: !!showMoreBtn,
        workingSelectors: {
          gameCards: workingSelector,
          showMoreButton: workingButtonSelector
        }
      };
      
      return results;
    });
    
    // Display results
    console.log('\n📊 TEST RESULTS:');
    console.log('================');
    console.log(`Page: ${testResults.pageTitle}`);
    console.log(`URL: ${testResults.url}\n`);
    
    testResults.tests.forEach((test, idx) => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${idx + 1}. ${status} ${test.test}`);
      console.log(`   ${test.details}\n`);
    });
    
    if (testResults.sampleGames && testResults.sampleGames.length > 0) {
      console.log('🎮 SAMPLE GAMES:');
      testResults.sampleGames.forEach((game, idx) => {
        console.log(`  ${idx + 1}. Solution: ${game.solution || 'Not found'}`);
        console.log(`     Date: ${game.dateString || 'Not found'}`);
        console.log(`     Skill: ${game.skillScore || 'Not found'}`);
        console.log(`     Luck: ${game.luckScore || 'Not found'}`);
        console.log(`     Raw text: ${game.rawText}\n`);
      });
    }
    
    console.log('📋 PAGE STRUCTURE:');
    console.log(`  Container found: ${testResults.pageStructure.hasContainer}`);
    console.log(`  Game data found: ${testResults.pageStructure.hasGameData}`);
    console.log(`  Pagination found: ${testResults.pageStructure.hasPagination}`);
    console.log(`  Working selectors:`, testResults.pageStructure.workingSelectors);
    
    // Save results
    const resultsDir = 'test-results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsFile = path.join(resultsDir, 'wordle-bot-profile-test.json');
    fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    
    const passedTests = testResults.tests.filter(t => t.passed).length;
    console.log(`\n🎯 SCORE: ${passedTests}/${testResults.tests.length} tests passed`);
    
    if (passedTests === testResults.tests.length) {
      console.log('🎉 ALL TESTS PASSED!');
    } else {
      console.log('⚠️  Some tests need attention. Check details above.');
    }
    
    console.log('\n👀 Browser window left open for manual inspection.');
    console.log('   Press Ctrl+C to close when done.');
    
    // Keep the browser open for manual inspection
    await new Promise(() => {}); // Wait indefinitely
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nThis might happen if:');
    console.log('- Edge profile is locked by another instance');
    console.log('- Permission issues with profile directory');
    console.log('- Network/loading issues');
  }
}

testWordleBotWithProfile().catch(console.error);