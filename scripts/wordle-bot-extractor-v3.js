    /**
     * Wordle Bot Game Extractor - Version 3
     * Based on actual page analysis results
     * 
     * Key findings:
     * - Container: #g-wordle-results
     * - 84 direct children (includes headers, labels, and game cards)
     * - Pagination: "+ Show more Wordles" button exists
     * - Button selector: .show-more-button.svelte-151vgtd
     * - Page is scrollable with pagination
     */

    (function() {
    console.log('=== Wordle Bot Game Extractor v3 ===\n');
    
    // REFINED: Find actual game cards (skip headers/labels)
    console.log('--- Finding actual game cards ---');
    
    const container = document.querySelector('#g-wordle-results');
    if (!container) {
        console.error('❌ Container not found!');
        return;
    }
    
    // Game cards have the rating-container class but NOT label-container
    const gameCards = Array.from(container.querySelectorAll('.rating-container.svelte-3c5k3b'))
        .filter(el => !el.classList.contains('label-container'));
    
    console.log(`Found ${gameCards.length} game cards (excluding labels)`);
    
    if (gameCards.length === 0) {
        console.warn('No game cards found. Trying alternative approach...');
        return;
    }
    
    // Analyze first game card structure
    console.log('\n--- Analyzing first game card ---');
    const firstCard = gameCards[0];
    console.log('First card HTML (500 chars):', firstCard.outerHTML.slice(0, 500));
    console.log('First card text:', firstCard.textContent.slice(0, 200));
    
    // Look for specific elements within the card
    console.log('\nSearching for data elements...');
    console.log('  Divs:', firstCard.querySelectorAll('div').length);
    console.log('  Links:', firstCard.querySelectorAll('a').length);
    console.log('  SVGs:', firstCard.querySelectorAll('svg').length);
    
    // Try to extract structured data
    function extractGameFromCard(card, index) {
        const game = { index };
        
        try {
        const text = card.textContent;
        
        // Extract solution word (5 uppercase letters)
        const wordMatch = text.match(/\b([A-Z]{5})\b/);
        if (wordMatch) game.solution = wordMatch[1];
        
        // Extract date
        const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/);
        if (dateMatch) {
            game.dateString = `${dateMatch[1]} ${dateMatch[2]}`;
            // Convert to ISO date (we'll need the year - assume current year or previous)
            const month = dateMatch[1];
            const day = parseInt(dateMatch[2]);
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            
            // Try current year first
            let testDate = new Date(`${month} ${day}, ${currentYear}`);
            if (testDate > currentDate) {
            // If date is in future, must be previous year
            testDate = new Date(`${month} ${day}, ${currentYear - 1}`);
            }
            
            game.date = testDate.toISOString().split('T')[0]; // YYYY-MM-DD
        }
        
        // Extract skill score
        const skillMatch = text.match(/(?:SKILL|Skill)\s+(\d+)/i);
        if (skillMatch) game.skillScore = parseInt(skillMatch[1]);
        
        // Extract luck score
        const luckMatch = text.match(/(?:LUCK|Luck)\s+(\d+)/i);
        if (luckMatch) game.luckScore = parseInt(luckMatch[1]);
        
        // Extract steps
        const stepsMatch = text.match(/(?:STEPS|Steps)\s+(\d+|X)/i);
        if (stepsMatch) {
            const stepsValue = stepsMatch[1];
            if (stepsValue === 'X') {
            game.steps = 0;
            game.won = false;
            } else {
            game.steps = parseInt(stepsValue);
            game.won = true;
            }
        }
        
        // Extract game number from text or link
        const gameNumMatch = text.match(/(?:Game|Wordle|#)\s*#?\s*(\d{3,4})/i);
        if (gameNumMatch) game.gameNumber = parseInt(gameNumMatch[1]);
        
        // Get analysis link
        const link = card.querySelector('a');
        if (link) game.analysisUrl = link.href;
        
        // Extract from link if game number not found
        if (!game.gameNumber && link) {
            const linkMatch = link.href.match(/wordle[/-](\d{3,4})/i);
            if (linkMatch) game.gameNumber = parseInt(linkMatch[1]);
        }
        
        } catch (e) {
        console.error(`Error extracting card ${index}:`, e);
        }
        
        return game;
    }
    
    // Extract first 5 games as detailed samples
    console.log('\n--- Extracting sample games ---');
    const samples = [];
    for (let i = 0; i < Math.min(5, gameCards.length); i++) {
        const game = extractGameFromCard(gameCards[i], i);
        samples.push(game);
        console.log(`\nGame ${i}:`, {
        solution: game.solution,
        date: game.date,
        gameNumber: game.gameNumber,
        skill: game.skillScore,
        luck: game.luckScore,
        steps: game.steps,
        won: game.won
        });
    }
    
    // Check "Show more" button
    console.log('\n--- Checking pagination ---');
    const showMoreBtn = document.querySelector('.show-more-button.svelte-151vgtd');
    const showMoreContainer = document.querySelector('.show-more-container.svelte-151vgtd');
    
    console.log('Show more button:', showMoreBtn);
    console.log('Show more container:', showMoreContainer);
    console.log('Button text:', showMoreBtn ? showMoreBtn.textContent : 'N/A');
    console.log('Button visible:', showMoreBtn ? (showMoreBtn.offsetParent !== null) : false);
    
    // Create extraction function
    function extractAllVisibleGames() {
        const cards = Array.from(document.querySelectorAll('#g-wordle-results .rating-container.svelte-3c5k3b'))
        .filter(el => !el.classList.contains('label-container'));
        
        const games = [];
        cards.forEach((card, idx) => {
        const game = extractGameFromCard(card, idx);
        if (game.solution || game.gameNumber) {
            games.push(game);
        }
        });
        
        return games;
    }
    
    // Create load more function
    async function loadMoreGames() {
        const btn = document.querySelector('.show-more-button.svelte-151vgtd');
        if (!btn || btn.offsetParent === null) {
        console.log('❌ No more games to load');
        return false;
        }
        
        const beforeCount = document.querySelectorAll('#g-wordle-results .rating-container.svelte-3c5k3b').length;
        
        console.log('Clicking "Show more" button...');
        btn.click();
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const afterCount = document.querySelectorAll('#g-wordle-results .rating-container.svelte-3c5k3b').length;
        const newGames = afterCount - beforeCount;
        
        console.log(`✅ Loaded ${newGames} new game cards`);
        return newGames > 0;
    }
    
    // Create automatic scraper
    async function scrapeAllGames(maxIterations = 20) {
        console.log('\n🚀 Starting automatic scrape...');
        
        const allGames = new Map();
        let iteration = 0;
        let hasMore = true;
        
        while (hasMore && iteration < maxIterations) {
        iteration++;
        console.log(`\n--- Iteration ${iteration} ---`);
        
        // Extract current games
        const currentGames = extractAllVisibleGames();
        console.log(`Found ${currentGames.length} games on page`);
        
        // Add to collection (using game number as key to avoid duplicates)
        currentGames.forEach(game => {
            if (game.gameNumber) {
            allGames.set(game.gameNumber, game);
            }
        });
        
        console.log(`Total unique games collected: ${allGames.size}`);
        
        // Try to load more
        hasMore = await loadMoreGames();
        
        if (!hasMore) {
            console.log('✅ No more games to load');
            break;
        }
        }
        
        if (iteration >= maxIterations) {
        console.warn(`⚠️  Stopped at ${maxIterations} iterations (safety limit)`);
        }
        
        const games = Array.from(allGames.values())
        .sort((a, b) => (b.gameNumber || 0) - (a.gameNumber || 0)); // Sort by game number, newest first
        
        console.log(`\n✅ Scraping complete!`);
        console.log(`   Total games: ${games.length}`);
        console.log(`   Date range: ${games[games.length - 1]?.dateString} to ${games[0]?.dateString}`);
        console.log(`   Game numbers: ${games[games.length - 1]?.gameNumber} to ${games[0]?.gameNumber}`);
        
        return games;
    }
    
    // Summary
    const summary = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        totalCardsFound: gameCards.length,
        hasShowMoreButton: !!showMoreBtn,
        showMoreButtonVisible: showMoreBtn ? (showMoreBtn.offsetParent !== null) : false,
        samples: samples.map(g => ({
        solution: g.solution,
        date: g.date,
        gameNumber: g.gameNumber,
        skillScore: g.skillScore,
        luckScore: g.luckScore,
        steps: g.steps,
        won: g.won
        })),
        selectors: {
        container: '#g-wordle-results',
        gameCard: '.rating-container.svelte-3c5k3b:not(.label-container)',
        showMoreButton: '.show-more-button.svelte-151vgtd'
        }
    };
    
    console.log('\n--- SUMMARY ---');
    console.log(summary);
    
    // Export functions
    window.__WORDLE_EXTRACTOR_V3__ = {
        summary,
        extractAllVisibleGames,
        extractGameFromCard,
        loadMoreGames,
        scrapeAllGames,
        gameCards
    };
    
    console.log('\n✅ Ready to scrape!');
    console.log('📊 See summary: window.__WORDLE_EXTRACTOR_V3__.summary');
    console.log('🎮 Extract visible: window.__WORDLE_EXTRACTOR_V3__.extractAllVisibleGames()');
    console.log('➕ Load more: await window.__WORDLE_EXTRACTOR_V3__.loadMoreGames()');
    console.log('🚀 SCRAPE ALL: await window.__WORDLE_EXTRACTOR_V3__.scrapeAllGames()');
    console.log('\n💡 To get all your games, run: await window.__WORDLE_EXTRACTOR_V3__.scrapeAllGames()');
    
    return summary;
    })();
