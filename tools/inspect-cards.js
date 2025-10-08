/**
 * Inspect what's actually in the game cards
 */

import { chromium } from 'playwright';

async function inspectCards() {
  console.log('🔍 Inspecting game card contents...\n');
  
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9223');
    const contexts = browser.contexts();
    const context = contexts[0];
    const pages = context.pages();
    
    let page = null;
    for (const p of pages) {
      if (p.url().includes('wordle-bot')) {
        page = p;
        break;
      }
    }
    
    if (!page) {
      console.log('❌ WordleBot page not found');
      return;
    }
    
    console.log('📄 Inspecting page content...\n');
    
    const inspection = await page.evaluate(() => {
      const result = {
        authCheck: {},
        cardContents: [],
        pageState: {}
      };
      
      // Check authentication status
      const bodyText = document.body.textContent.toLowerCase();
      result.authCheck = {
        hasPaywall: bodyText.includes('subscribe') || bodyText.includes('paywall'),
        hasLoginPrompt: bodyText.includes('log in') || bodyText.includes('sign in'),
        hasAccountMenu: !!document.querySelector('[data-testid="account-menu"], .user-menu, [aria-label*="account"]'),
        bodyTextSample: document.body.textContent.slice(0, 500)
      };
      
      // Get actual card contents
      const cards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      
      Array.from(cards).slice(0, 5).forEach((card, idx) => {
        const cardInfo = {
          index: idx,
          className: card.className,
          textContent: card.textContent.trim(),
          innerHTML: card.innerHTML.slice(0, 300),
          hasSkillText: card.textContent.includes('skill'),
          hasLuckText: card.textContent.includes('luck'),
          hasSolutionText: card.textContent.includes('solution'),
          hasDateText: /January|February|March|April|May|June|July|August|September|October|November|December/.test(card.textContent)
        };
        
        result.cardContents.push(cardInfo);
      });
      
      // Check page state
      result.pageState = {
        currentUrl: window.location.href,
        hasContainer: !!document.querySelector('#g-wordle-results'),
        containerText: document.querySelector('#g-wordle-results')?.textContent.slice(0, 200),
        totalCards: cards.length
      };
      
      return result;
    });
    
    console.log('🔐 AUTHENTICATION CHECK:');
    console.log('========================');
    console.log('Has paywall text:', inspection.authCheck.hasPaywall);
    console.log('Has login prompt:', inspection.authCheck.hasLoginPrompt); 
    console.log('Has account menu:', inspection.authCheck.hasAccountMenu);
    console.log('Body text sample:', inspection.authCheck.bodyTextSample);
    
    console.log('\n📊 PAGE STATE:');
    console.log('==============');
    console.log('URL:', inspection.pageState.currentUrl);
    console.log('Has container:', inspection.pageState.hasContainer);
    console.log('Total cards found:', inspection.pageState.totalCards);
    console.log('Container text:', inspection.pageState.containerText);
    
    console.log('\n🎴 CARD CONTENTS:');
    console.log('=================');
    
    if (inspection.cardContents.length === 0) {
      console.log('❌ No cards found to inspect');
    } else {
      inspection.cardContents.forEach(card => {
        console.log(`\nCard ${card.index + 1}:`);
        console.log(`  Class: ${card.className}`);
        console.log(`  Has skill: ${card.hasSkillText}`);
        console.log(`  Has luck: ${card.hasLuckText}`);
        console.log(`  Has solution: ${card.hasSolutionText}`);
        console.log(`  Has date: ${card.hasDateText}`);
        console.log(`  Text content: "${card.textContent}"`);
        console.log(`  HTML preview: ${card.innerHTML}`);
      });
    }
    
    // Diagnosis
    console.log('\n🩺 DIAGNOSIS:');
    console.log('=============');
    
    if (inspection.authCheck.hasPaywall || inspection.authCheck.hasLoginPrompt) {
      console.log('❌ AUTHENTICATION ISSUE: You need to log in or subscribe');
    } else if (inspection.cardContents.length === 0) {
      console.log('❌ NO CARDS: Selectors not finding game cards');
    } else if (inspection.cardContents.every(card => !card.hasSkillText)) {
      console.log('❌ EMPTY CARDS: Cards found but contain no game data');
      console.log('   This could mean:');
      console.log('   - Not logged in properly');
      console.log('   - No game history available');
      console.log('   - Page still loading');
    } else {
      console.log('✅ CARDS HAVE DATA: Game information is present');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

inspectCards().catch(console.error);