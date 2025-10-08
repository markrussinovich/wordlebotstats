// Script to inspect the actual DOM structure of WordleBot page
const { chromium } = require('playwright');

async function inspectWordleBotPage() {
  console.log('🔍 Inspecting WordleBot page structure...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('📱 Navigating to WordleBot page...');
    await page.goto('https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html');
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    console.log('🔍 Looking for game-related elements...');
    
    // Try various selectors that might contain game data
    const selectors = [
      '.rating-container',
      '[class*="rating"]',
      '[class*="game"]',
      '[class*="result"]',
      '[class*="row"]',
      '[class*="score"]',
      '[class*="wordle"]',
      'article',
      '.game-row',
      '.game-card',
      '[data-testid*="game"]',
      '[data-game]',
      '.score',
      '.result'
    ];
    
    for (const selector of selectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
        
        // Get some sample HTML from the first few elements
        for (let i = 0; i < Math.min(3, elements.length); i++) {
          const html = await elements[i].innerHTML();
          const text = await elements[i].textContent();
          console.log(`   Element ${i + 1} HTML (first 200 chars): ${html.substring(0, 200)}...`);
          console.log(`   Element ${i + 1} Text: ${text?.substring(0, 100)}...`);
        }
        console.log('');
      }
    }
    
    // Look for any elements that might contain "Wordle" or game numbers
    console.log('🎯 Looking for elements containing "Wordle" text...');
    const wordleElements = await page.$$('text=/Wordle.*\\d+/i');
    console.log(`Found ${wordleElements.length} elements with "Wordle" and numbers`);
    
    for (let i = 0; i < Math.min(5, wordleElements.length); i++) {
      const text = await wordleElements[i].textContent();
      const parent = await wordleElements[i].evaluateHandle(el => el.parentElement);
      const parentClass = await parent.getAttribute('class');
      console.log(`   Wordle element ${i + 1}: "${text}" (parent class: ${parentClass})`);
    }
    
    // Look for containers that might hold multiple games
    console.log('📦 Looking for potential game containers...');
    const containerElements = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const containers = [];
      
      for (const el of allElements) {
        const children = el.children.length;
        const text = el.textContent || '';
        
        // Look for elements that have multiple children and contain "Wordle"
        if (children >= 3 && text.includes('Wordle') && text.length > 50) {
          containers.push({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            childrenCount: children,
            textSnippet: text.substring(0, 100)
          });
        }
      }
      
      return containers.slice(0, 10); // Limit to first 10
    });
    
    console.log('Found potential game containers:');
    containerElements.forEach((container, i) => {
      console.log(`   ${i + 1}. <${container.tagName}> class="${container.className}" id="${container.id}"`);
      console.log(`      Children: ${container.childrenCount}, Text: "${container.textSnippet}..."`);
    });
    
  } catch (error) {
    console.error('❌ Error inspecting page:', error.message);
  }

  console.log('🔍 Inspection complete. Please check the results above.');
  console.log('Press any key to close browser...');
  
  // Keep browser open for manual inspection
  await page.waitForTimeout(30000);
  await browser.close();
}

inspectWordleBotPage().catch(console.error);