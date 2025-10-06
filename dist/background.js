// src/extension/background/extensionStorage.ts
var ExtensionStorage = class _ExtensionStorage {
  constructor() {
  }
  static getInstance() {
    if (!_ExtensionStorage.instance) {
      _ExtensionStorage.instance = new _ExtensionStorage();
    }
    return _ExtensionStorage.instance;
  }
  async initialize() {
    console.log("[ExtensionStorage] Initialized");
  }
  async getAllGames() {
    try {
      const result = await chrome.storage.local.get("games");
      return result.games || [];
    } catch (error) {
      console.error("[ExtensionStorage] Failed to get games:", error);
      return [];
    }
  }
  async saveGame(game) {
    try {
      const games = await this.getAllGames();
      const existingIndex = games.findIndex((g) => g.date === game.date);
      if (existingIndex >= 0) {
        games[existingIndex] = game;
      } else {
        games.push(game);
      }
      await chrome.storage.local.set({ games });
    } catch (error) {
      console.error("[ExtensionStorage] Failed to save game:", error);
      throw error;
    }
  }
  async bulkImportGames(newGames) {
    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    try {
      const existingGames = await this.getAllGames();
      const gameMap = /* @__PURE__ */ new Map();
      existingGames.forEach((game) => {
        gameMap.set(game.date, game);
      });
      for (const game of newGames) {
        try {
          const existing = gameMap.get(game.date);
          if (existing) {
            const shouldReplace = this.shouldReplaceExisting(existing, game);
            if (shouldReplace) {
              gameMap.set(game.date, game);
              imported++;
            } else {
              duplicates++;
            }
          } else {
            gameMap.set(game.date, game);
            imported++;
          }
        } catch (error) {
          console.error("[ExtensionStorage] Failed to process game:", game.date, error);
          errors++;
        }
      }
      const allGames = Array.from(gameMap.values());
      await chrome.storage.local.set({ games: allGames });
    } catch (error) {
      console.error("[ExtensionStorage] Bulk import failed:", error);
      throw error;
    }
    return { imported, duplicates, errors };
  }
  shouldReplaceExisting(existing, newGame) {
    const existingScore = this.getDataRichnessScore(existing);
    const newScore = this.getDataRichnessScore(newGame);
    return newScore > existingScore;
  }
  getDataRichnessScore(game) {
    let score = 0;
    score += 1;
    if (game.skillScore !== void 0) score += 2;
    if (game.luckScore !== void 0) score += 2;
    if (game.analysisUrl) score += 1;
    if (game.solution) score += 1;
    if (game.guessPattern && game.guessPattern.length > 0) score += 2;
    if (game.duration || game.timeToComplete) score += 1;
    return score;
  }
  async getNewestGame() {
    try {
      const games = await this.getAllGames();
      if (games.length === 0) return null;
      return games.reduce((newest, game) => {
        return new Date(game.date) > new Date(newest.date) ? game : newest;
      });
    } catch (error) {
      console.error("[ExtensionStorage] Failed to get newest game:", error);
      return null;
    }
  }
  async getScraperMetadata() {
    try {
      const result = await chrome.storage.local.get("scraperMetadata");
      const metadata = result.scraperMetadata || {};
      return {
        lastScrape: metadata.lastScrape || null,
        lastScrapeMode: metadata.lastScrapeMode || null,
        totalScraped: metadata.totalScraped || 0,
        lastError: metadata.lastError || null
      };
    } catch (error) {
      console.error("[ExtensionStorage] Failed to get scraper metadata:", error);
      return {
        lastScrape: null,
        lastScrapeMode: null,
        totalScraped: 0,
        lastError: null
      };
    }
  }
  async updateScraperMetadata(update) {
    try {
      const current = await this.getScraperMetadata();
      const newMetadata = {
        lastScrape: update.lastScrape || current.lastScrape,
        lastScrapeMode: update.lastScrapeMode || current.lastScrapeMode,
        totalScraped: update.totalScraped !== void 0 ? update.totalScraped : current.totalScraped,
        lastError: update.lastError !== void 0 ? update.lastError : current.lastError
      };
      await chrome.storage.local.set({ scraperMetadata: newMetadata });
    } catch (error) {
      console.error("[ExtensionStorage] Failed to update scraper metadata:", error);
    }
  }
  async getPreferences() {
    try {
      const result = await chrome.storage.sync.get("preferences");
      return result.preferences || null;
    } catch (error) {
      console.error("[ExtensionStorage] Failed to get preferences:", error);
      return null;
    }
  }
};

// src/extension/background/background.ts
var storageService;
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[Background] Extension installed:", details.reason);
  try {
    storageService = ExtensionStorage.getInstance();
    await storageService.initialize();
    if (details.reason === "install") {
      await initializeExtension();
    } else if (details.reason === "update") {
      await handleExtensionUpdate(details.previousVersion);
    }
  } catch (error) {
    console.error("[Background] Extension initialization failed:", error);
  }
});
chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    console.log("[BACKGROUND DEBUG] Received message:", message.type, message);
    console.log("[BACKGROUND DEBUG] Sender:", sender);
    handleExtensionMessage(message, sender).then((response) => {
      console.log("[BACKGROUND DEBUG] Sending response:", response);
      if (response) {
        sendResponse(response);
      }
    }).catch((error) => {
      console.error("[BACKGROUND DEBUG] Message handling error:", error);
      sendResponse({
        success: false,
        error: error.message
      });
    });
    return true;
  }
);
async function initializeExtension() {
  try {
    await chrome.storage.sync.set({
      preferences: {
        theme: "system",
        defaultTimeFrame: "30d",
        showBenchmarks: true,
        enableNotifications: false,
        autoImport: true
      },
      lastSyncTime: Date.now(),
      version: chrome.runtime.getManifest().version
    });
    console.log("[Background] Extension initialized with default settings");
  } catch (error) {
    console.error("[Background] Failed to initialize extension:", error);
  }
}
async function handleExtensionUpdate(previousVersion) {
  try {
    console.log(`[Background] Updating from version ${previousVersion}`);
    if (previousVersion && compareVersions(previousVersion, "1.0.0") < 0) {
      await migrateToV1();
    }
    await chrome.storage.sync.set({
      version: chrome.runtime.getManifest().version,
      lastUpdateTime: Date.now()
    });
  } catch (error) {
    console.error("[Background] Failed to handle extension update:", error);
  }
}
async function handleExtensionMessage(message, _sender) {
  switch (message.type) {
    case "IMPORT_GAME_RESULT" /* IMPORT_GAME_RESULT */:
      return handleImportGameResult(message);
    case "GET_QUICK_STATS" /* GET_QUICK_STATS */:
      return handleGetQuickStats(message);
    case "GET_DASHBOARD_DATA" /* GET_DASHBOARD_DATA */:
      return handleGetDashboardData(message);
    case "SYNC_DATA" /* SYNC_DATA */:
      return handleSyncData();
    case "EXPORT_DATA" /* EXPORT_DATA */:
      return handleExportData();
    case "CLEAR_DATA" /* CLEAR_DATA */:
      return handleClearData();
    case "START_WORDLE_BOT_SCRAPE" /* START_WORDLE_BOT_SCRAPE */:
      return handleStartWordleBotScrape(message);
    case "BULK_IMPORT_GAMES":
      return handleBulkImportGames(message.games);
    case "WORDLE_BOT_SCRAPE_PROGRESS" /* WORDLE_BOT_SCRAPE_PROGRESS */:
      return handleWordleBotScrapeProgress(message);
    case "WORDLE_BOT_SCRAPE_COMPLETE" /* WORDLE_BOT_SCRAPE_COMPLETE */:
      return handleWordleBotScrapeComplete(message);
    case "WORDLE_BOT_SCRAPE_ERROR" /* WORDLE_BOT_SCRAPE_ERROR */:
      return handleWordleBotScrapeError(message);
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
async function handleImportGameResult(message) {
  try {
    console.log("[Background] Importing game result:", message.gameResult);
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    await storageService.saveGame(message.gameResult);
    console.log("[Background] Game result saved successfully");
    const games = await storageService.getAllGames();
    await updateExtensionBadge(games);
  } catch (error) {
    console.error("[Background] Failed to import game result:", error);
    throw error;
  }
}
async function handleGetQuickStats(message) {
  try {
    const result = await chrome.storage.local.get(["games"]);
    const games = result.games || [];
    console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Total games in storage: ${games.length}`);
    console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Timeframe requested: ${message.timeFrame}`);
    if (games.length > 0) {
      console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Sample game dates:`, games.slice(0, 5).map((g) => g.date));
    }
    const filteredGames = filterGamesByTimeFrame(games, message.timeFrame);
    console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Filtered games count: ${filteredGames.length}`);
    if (filteredGames.length > 0) {
      console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Filtered game dates:`, filteredGames.map((g) => g.date));
    }
    const statistics = calculateStatistics(filteredGames, games);
    console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Calculated statistics:`, statistics);
    return {
      success: true,
      statistics: {
        ...statistics,
        gameCount: filteredGames.length
      },
      timeFrame: message.timeFrame
    };
  } catch (error) {
    console.error("[Background] Failed to get quick stats:", error);
    throw error;
  }
}
async function handleGetDashboardData(message) {
  try {
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    const [games, preferences] = await Promise.all([
      storageService.getAllGames(),
      storageService.getPreferences()
    ]);
    const benchmarksResult = await chrome.storage.local.get(["benchmarks"]);
    return {
      success: true,
      games,
      benchmarks: benchmarksResult.benchmarks || [],
      preferences: preferences || {},
      timeFrames: message.timeFrames || ["7d", "30d", "90d", "all"]
    };
  } catch (error) {
    console.error("[Background] Failed to get dashboard data:", error);
    throw error;
  }
}
async function handleSyncData() {
  try {
    console.log("[Background] Synchronizing data...");
    const { preferences } = await chrome.storage.sync.get(["preferences"]);
    if (preferences?.cloudSync) {
      console.log("[Background] Cloud sync is enabled, syncing data...");
    }
    await chrome.storage.sync.set({
      lastSyncTime: Date.now()
    });
  } catch (error) {
    console.error("[Background] Failed to sync data:", error);
    throw error;
  }
}
async function handleExportData() {
  try {
    const result = await chrome.storage.local.get(["games"]);
    const games = result.games || [];
    const exportData = {
      version: chrome.runtime.getManifest().version,
      exportDate: (/* @__PURE__ */ new Date()).toISOString(),
      games
    };
    return {
      data: JSON.stringify(exportData, null, 2),
      filename: `wordle-stats-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`
    };
  } catch (error) {
    console.error("[Background] Failed to export data:", error);
    throw error;
  }
}
async function handleClearData() {
  try {
    await chrome.storage.local.clear();
    await chrome.storage.sync.remove(["lastSyncTime", "lastImportTime"]);
    chrome.action.setBadgeText({ text: "" });
    console.log("[Background] All data cleared");
  } catch (error) {
    console.error("[Background] Failed to clear data:", error);
    throw error;
  }
}
var scraperTabId = null;
async function handleStartWordleBotScrape(message) {
  try {
    console.log(`[BACKGROUND DEBUG] Starting WordleBot scrape (mode: ${message.mode})`);
    console.log("[BACKGROUND DEBUG] Storage service available:", !!storageService);
    if (!storageService) {
      console.log("[BACKGROUND DEBUG] Initializing storage service...");
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    let stopAtDate;
    let newestStoredGame = null;
    if (message.mode === "incremental" || message.mode === "auto") {
      console.log("[BACKGROUND DEBUG] Getting newest game for incremental mode...");
      newestStoredGame = await storageService.getNewestGame();
      stopAtDate = newestStoredGame?.date;
      console.log("[BACKGROUND DEBUG] Newest stored game:", newestStoredGame?.date, "Game#", newestStoredGame?.gameNumber);
    }
    console.log("[BACKGROUND DEBUG] Storing scrape parameters in storage...");
    await chrome.storage.local.set({
      wordleBotScrapeParams: {
        mode: message.mode,
        stopAtDate,
        maxIterations: message.maxIterations || 20,
        timestamp: Date.now()
      }
    });
    console.log("[BACKGROUND DEBUG] Creating WordleBot tab...");
    const tab = await chrome.tabs.create({
      url: "https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html",
      active: false
    });
    scraperTabId = tab.id || null;
    console.log("[BACKGROUND DEBUG] Opened WordleBot tab:", scraperTabId);
    console.log("[BACKGROUND DEBUG] Tab created, content script will auto-start scraping");
    return { success: true, ...scraperTabId ? { tabId: scraperTabId } : {}, message: "Scraping started" };
  } catch (error) {
    console.error("[Background] Failed to start WordleBot scrape:", error);
    if (scraperTabId) {
      chrome.tabs.remove(scraperTabId).catch(() => {
      });
      scraperTabId = null;
    }
    throw error;
  }
}
async function handleBulkImportGames(games) {
  try {
    console.log(`[Background] Bulk importing ${games.length} games`);
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    const result = await storageService.bulkImportGames(games);
    console.log("[Background] Bulk import complete:", result);
    const allGames = await storageService.getAllGames();
    await updateExtensionBadge(allGames);
    return { success: true, ...result };
  } catch (error) {
    console.error("[Background] Failed to bulk import games:", error);
    return { success: false, imported: 0, duplicates: 0, errors: games.length };
  }
}
async function handleWordleBotScrapeProgress(message) {
  console.log("[Background] Scrape progress:", message);
  chrome.runtime.sendMessage(message).catch(() => {
  });
}
async function handleWordleBotScrapeComplete(message) {
  console.log("[Background] Scrape complete:", message);
  await storageService.updateScraperMetadata({
    lastScrape: (/* @__PURE__ */ new Date()).toISOString(),
    lastScrapeMode: "auto",
    // or get from message
    totalScraped: message.totalGames
  });
  if (scraperTabId) {
    setTimeout(() => {
      if (scraperTabId) {
        chrome.tabs.remove(scraperTabId).catch(() => {
        });
        scraperTabId = null;
      }
    }, 2e3);
  }
  chrome.runtime.sendMessage(message).catch(() => {
  });
}
async function handleWordleBotScrapeError(message) {
  console.error("[Background] Scrape error:", message);
  await storageService.updateScraperMetadata({
    lastError: message.error
  });
  if (scraperTabId) {
    chrome.tabs.remove(scraperTabId).catch(() => {
    });
    scraperTabId = null;
  }
  chrome.runtime.sendMessage(message).catch(() => {
  });
}
async function updateExtensionBadge(games) {
  try {
    const statistics = calculateStatistics(games);
    const streak = statistics.currentStreak;
    if (streak > 0) {
      chrome.action.setBadgeText({
        text: streak.toString()
      });
      chrome.action.setBadgeBackgroundColor({
        color: "#22c55e"
      });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (error) {
    console.error("[Background] Failed to update badge:", error);
  }
}
function filterGamesByTimeFrame(games, timeFrame) {
  if (timeFrame === "all") return games;
  const now = /* @__PURE__ */ new Date();
  const cutoffDate = /* @__PURE__ */ new Date();
  switch (timeFrame) {
    case "7d":
      cutoffDate.setDate(now.getDate() - 7);
      break;
    case "30d":
      cutoffDate.setDate(now.getDate() - 30);
      break;
    case "90d":
      cutoffDate.setDate(now.getDate() - 90);
      break;
    default:
      return games;
  }
  console.log(`[BACKGROUND DEBUG] filterGamesByTimeFrame: Cutoff date for ${timeFrame}: ${cutoffDate.toISOString()}`);
  const filtered = games.filter((game) => {
    if (!game.date) return false;
    const gameDate = new Date(game.date);
    return gameDate >= cutoffDate;
  });
  console.log(`[BACKGROUND DEBUG] filterGamesByTimeFrame: Filtered ${filtered.length} games from ${games.length} total (cutoff: ${cutoffDate.toISOString()})`);
  return filtered;
}
function calculateStatistics(games, allGames) {
  if (games.length === 0) {
    return {
      winRate: 0,
      averageGuesses: 0,
      currentStreak: 0,
      maxStreak: 0,
      gameCount: 0
    };
  }
  const wins = games.filter((game) => game.won);
  const winRate = wins.length / games.length * 100;
  const totalGuesses = wins.reduce((sum, game) => sum + (game.attempts || 0), 0);
  const averageGuesses = wins.length > 0 ? totalGuesses / wins.length : 0;
  const gamesToUseForStreaks = allGames || games;
  const sortedAllGames = [...gamesToUseForStreaks].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  let currentStreak = 0;
  for (let i = sortedAllGames.length - 1; i >= 0; i--) {
    if (sortedAllGames[i].won) {
      currentStreak++;
    } else {
      break;
    }
  }
  let maxStreak = 0;
  let tempStreak = 0;
  for (let i = 0; i < sortedAllGames.length; i++) {
    if (sortedAllGames[i].won) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  console.log(`[BACKGROUND DEBUG] calculateStatistics: Using ${gamesToUseForStreaks.length} games for streaks, ${games.length} games for other stats`);
  console.log(`[BACKGROUND DEBUG] calculateStatistics: currentStreak=${currentStreak}, maxStreak=${maxStreak}`);
  return {
    winRate,
    averageGuesses,
    currentStreak,
    maxStreak,
    gameCount: games.length
  };
}
function compareVersions(version1, version2) {
  const v1parts = version1.split(".").map(Number);
  const v2parts = version2.split(".").map(Number);
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    if (v1part < v2part) return -1;
    if (v1part > v2part) return 1;
  }
  return 0;
}
async function migrateToV1() {
  console.log("[Background] Migrating to version 1.0.0");
}
