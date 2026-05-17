var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/extension/utils/logger.ts
var g = globalThis;
function resolveEnvFlag() {
  try {
    if (typeof import.meta !== "undefined" && import.meta?.env) {
      const val = import.meta.env.VITE_DEBUG_LOGS;
      if (val != null)
        return val === "true" || val === true;
    }
  } catch {
  }
  try {
    if (typeof process !== "undefined" && process?.env) {
      const v = process.env.VITE_DEBUG_LOGS;
      if (v != null)
        return v === "true";
    }
  } catch {
  }
  return false;
}
function resolveStorageFlag() {
  try {
    return localStorage.getItem("WORDLE_DEBUG_LOGS") === "true";
  } catch {
    return false;
  }
}
var enabled = resolveEnvFlag() || resolveStorageFlag();
function setDebugLogging(on) {
  enabled = on;
  try {
    localStorage.setItem("WORDLE_DEBUG_LOGS", on ? "true" : "false");
  } catch {
  }
}
g.WORDLE_ENABLE_DEBUG_LOGS = () => setDebugLogging(true);
g.WORDLE_DISABLE_DEBUG_LOGS = () => setDebugLogging(false);
function prefix() {
  return `[${(/* @__PURE__ */ new Date()).toISOString()}]`;
}
function build(method) {
  return (...args) => {
    if (enabled)
      console[method](prefix(), ...args);
  };
}
var logger = {
  enabled: () => enabled,
  log: build("log"),
  warn: build("warn"),
  error: build("error")
};
var logger_default = logger;

// src/extension/background/extensionStorage.ts
var log = logger_default.log;
var errorLog = logger_default.error;
var _ExtensionStorage = class _ExtensionStorage {
  constructor() {
  }
  static getInstance() {
    if (!_ExtensionStorage.instance) {
      _ExtensionStorage.instance = new _ExtensionStorage();
    }
    return _ExtensionStorage.instance;
  }
  async initialize() {
    log("[ExtensionStorage] Initialized");
  }
  async getAllGames() {
    try {
      const result = await chrome.storage.local.get("games");
      return result.games || [];
    } catch (error) {
      errorLog("[ExtensionStorage] Failed to get games:", error);
      return [];
    }
  }
  async saveGame(game) {
    try {
      const games = await this.getAllGames();
      const existingIndex = games.findIndex((g2) => g2.date === game.date);
      if (existingIndex >= 0) {
        games[existingIndex] = game;
      } else {
        games.push(game);
      }
      await chrome.storage.local.set({ games });
    } catch (error) {
      errorLog("[ExtensionStorage] Failed to save game:", error);
      throw error;
    }
  }
  async bulkImportGames(newGames) {
    log(`[ExtensionStorage] =====> bulkImportGames called with ${newGames.length} games`);
    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    try {
      log(`[ExtensionStorage] =====> Reading existing games...`);
      const startRead = performance.now();
      const existingGames = await this.getAllGames();
      log(`[ExtensionStorage] =====> Read ${existingGames.length} existing games in ${(performance.now() - startRead).toFixed(0)}ms`);
      const gameMap = /* @__PURE__ */ new Map();
      existingGames.forEach((game) => {
        gameMap.set(game.date, game);
      });
      log(`[ExtensionStorage] =====> Processing ${newGames.length} new games...`);
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
          errorLog("[ExtensionStorage] Failed to process game:", game.date, error);
          errors++;
        }
      }
      log(`[ExtensionStorage] =====> Writing ${gameMap.size} total games to storage...`);
      const startWrite = performance.now();
      const allGames = Array.from(gameMap.values());
      log(`[ExtensionStorage] =====> Stripping board images from ${allGames.length} games...`);
      const lightweightGames = allGames.map((g2) => ({
        ...g2,
        boardImageUrl: void 0
        // Strip large base64 data URLs
      }));
      log(`[ExtensionStorage] =====> Calling chrome.storage.local.set...`);
      await chrome.storage.local.set({ games: lightweightGames });
      log(`[ExtensionStorage] =====> Write completed in ${(performance.now() - startWrite).toFixed(0)}ms`);
    } catch (error) {
      console.error("[ExtensionStorage] Bulk import failed:", error);
      throw error;
    }
    log(`[ExtensionStorage] =====> bulkImportGames complete: imported=${imported}, duplicates=${duplicates}, errors=${errors}`);
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
    if (game.skillScore !== void 0)
      score += 2;
    if (game.luckScore !== void 0)
      score += 2;
    if (game.analysisUrl)
      score += 1;
    if (game.solution)
      score += 1;
    if (game.guessPattern && game.guessPattern.length > 0)
      score += 2;
    if (game.duration || game.timeToComplete)
      score += 1;
    return score;
  }
  async getNewestGame() {
    try {
      const games = await this.getAllGames();
      if (games.length === 0)
        return null;
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
__publicField(_ExtensionStorage, "instance");
var ExtensionStorage = _ExtensionStorage;

// src/extension/background/background.ts
var log2 = logger_default.log;
var errorLog2 = logger_default.error;
var storageService;
var SCRAPE_STATUS_STORAGE_KEY = "wordleBotScrapeStatus";
var dashboardTabId = null;
var currentScrapeStatus = {
  phase: "idle",
  gamesFound: 0,
  gamesProcessed: 0,
  newGames: 0,
  duplicates: 0,
  errors: 0,
  lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
  statusMessage: "Idle",
  error: null
};
async function updateScrapeStatus(update) {
  const nextPhase = update.phase ?? currentScrapeStatus.phase;
  currentScrapeStatus = {
    ...currentScrapeStatus,
    ...update,
    phase: nextPhase,
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    await chrome.storage.local.set({
      [SCRAPE_STATUS_STORAGE_KEY]: currentScrapeStatus
    });
  } catch (storageError) {
    errorLog2("[Background] Failed to persist scrape status:", storageError);
  }
  log2("[Background] =====> Sending WORDLE_BOT_SCRAPE_STATUS_UPDATED message:", currentScrapeStatus);
  chrome.runtime.sendMessage({
    type: "WORDLE_BOT_SCRAPE_STATUS_UPDATED" /* WORDLE_BOT_SCRAPE_STATUS_UPDATED */,
    status: currentScrapeStatus
  }).then(() => {
    log2("[Background] =====> STATUS_UPDATED message sent successfully");
  }).catch((err) => {
    log2("[Background] =====> STATUS_UPDATED message failed:", err);
  });
}
async function loadInitialScrapeStatus() {
  try {
    const result = await chrome.storage.local.get([SCRAPE_STATUS_STORAGE_KEY]);
    if (result && result[SCRAPE_STATUS_STORAGE_KEY]) {
      currentScrapeStatus = {
        ...currentScrapeStatus,
        ...result[SCRAPE_STATUS_STORAGE_KEY]
      };
    } else {
      await chrome.storage.local.set({
        [SCRAPE_STATUS_STORAGE_KEY]: currentScrapeStatus
      });
    }
  } catch (error) {
    errorLog2("[Background] Failed to hydrate scrape status from storage:", error);
  }
}
loadInitialScrapeStatus().catch(() => {
});
chrome.runtime.onInstalled.addListener(async (details) => {
  log2("[Background] Extension installed:", details.reason);
  try {
    storageService = ExtensionStorage.getInstance();
    await storageService.initialize();
    if (details.reason === "install") {
      await initializeExtension();
    } else if (details.reason === "update") {
      await handleExtensionUpdate(details.previousVersion);
    }
  } catch (error) {
    errorLog2("[Background] Extension initialization failed:", error);
  }
});
chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    log2("[BACKGROUND DEBUG] Received message:", message.type, message);
    log2("[BACKGROUND DEBUG] Sender:", sender);
    handleExtensionMessage(message, sender).then((response) => {
      log2("[BACKGROUND DEBUG] Sending response:", response);
      sendResponse(response ?? null);
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
    case "OPEN_DASHBOARD_TAB" /* OPEN_DASHBOARD_TAB */:
      return handleOpenDashboardTab(message);
    case "SYNC_DATA" /* SYNC_DATA */:
      return handleSyncData();
    case "EXPORT_DATA" /* EXPORT_DATA */:
      return handleExportData();
    case "CLEAR_DATA" /* CLEAR_DATA */:
      return handleClearData();
    case "START_WORDLE_BOT_SCRAPE" /* START_WORDLE_BOT_SCRAPE */:
      return handleStartWordleBotScrape(message);
    case "BULK_IMPORT_GAMES":
      console.log(`[Background] =====> Received BULK_IMPORT_GAMES message`);
      return handleBulkImportGames(message.games);
    case "WORDLE_BOT_SCRAPE_PROGRESS" /* WORDLE_BOT_SCRAPE_PROGRESS */:
      return handleWordleBotScrapeProgress(message);
    case "WORDLE_BOT_SCRAPE_COMPLETE" /* WORDLE_BOT_SCRAPE_COMPLETE */:
      return handleWordleBotScrapeComplete(message);
    case "WORDLE_BOT_SCRAPE_ERROR" /* WORDLE_BOT_SCRAPE_ERROR */:
      return handleWordleBotScrapeError(message);
    case "GET_WORDLE_BOT_SCRAPE_STATUS" /* GET_WORDLE_BOT_SCRAPE_STATUS */:
      return handleGetWordleBotScrapeStatus();
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
    return { success: true };
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
      console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Sample game dates:`, games.slice(0, 5).map((g2) => g2.date));
    }
    const filteredGames = filterGamesByTimeFrame(games, message.timeFrame);
    console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Filtered games count: ${filteredGames.length}`);
    if (filteredGames.length > 0) {
      console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Filtered game dates:`, filteredGames.map((g2) => g2.date));
      console.log(
        `[BACKGROUND DEBUG] GET_QUICK_STATS: Filtered game details:`,
        filteredGames.map((g2) => {
          const turns = (() => {
            if (typeof g2.attempts === "number" && !Number.isNaN(g2.attempts)) {
              return g2.attempts;
            }
            if (typeof g2.guesses === "number" && !Number.isNaN(g2.guesses)) {
              return g2.guesses;
            }
            if (typeof g2.steps === "number" && !Number.isNaN(g2.steps)) {
              return g2.steps;
            }
            if (Array.isArray(g2.guessPattern)) {
              return g2.guessPattern.length;
            }
            return 0;
          })();
          return {
            date: g2.date,
            turns,
            won: g2.won === true
          };
        })
      );
    }
    const statistics = calculateStatistics(filteredGames, games);
    console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Calculated statistics:`, statistics);
    let lastGame = null;
    if (games.length > 0) {
      const sortedGames = [...games].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      lastGame = sortedGames[0];
      console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Last game:`, lastGame);
    }
    return {
      success: true,
      statistics,
      lastGame,
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
    let stopAtDate = message.stopAtDate;
    let newestStoredGame = null;
    if ((message.mode === "incremental" || message.mode === "auto") && !stopAtDate) {
      console.log("[BACKGROUND DEBUG] Getting newest game for incremental mode...");
      newestStoredGame = await storageService.getNewestGame();
      stopAtDate = newestStoredGame?.date;
      console.log("[BACKGROUND DEBUG] Newest stored game:", newestStoredGame?.date, "Game#", newestStoredGame?.gameNumber);
    } else if (stopAtDate) {
      console.log("[BACKGROUND DEBUG] Using provided stopAtDate:", stopAtDate);
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
    await updateScrapeStatus({
      phase: "checking",
      gamesFound: 0,
      gamesProcessed: 0,
      newGames: 0,
      duplicates: 0,
      errors: 0,
      mode: message.mode,
      error: null,
      statusMessage: "Checking for latest games"
    });
    return { success: true, ...scraperTabId ? { tabId: scraperTabId } : {}, message: "Scraping started" };
  } catch (error) {
    console.error("[Background] Failed to start WordleBot scrape:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateScrapeStatus({
      phase: "error",
      statusMessage: "Failed to start scrape",
      error: errorMessage
    });
    if (scraperTabId) {
      chrome.tabs.remove(scraperTabId).catch(() => {
      });
      scraperTabId = null;
    }
    throw error;
  }
}
async function handleGetWordleBotScrapeStatus() {
  console.log("[Background] GET_WORDLE_BOT_SCRAPE_STATUS requested, returning:", currentScrapeStatus);
  return {
    success: true,
    status: {
      ...currentScrapeStatus
    }
  };
}
async function handleBulkImportGames(games) {
  try {
    console.log(`[Background] =====> handleBulkImportGames called with ${games.length} games`);
    const startTime = performance.now();
    if (!storageService) {
      console.log(`[Background] =====> Initializing storage service...`);
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
      console.log(`[Background] =====> Storage service initialized`);
    }
    console.log(`[Background] =====> Calling storageService.bulkImportGames...`);
    const result = await storageService.bulkImportGames(games);
    const duration = (performance.now() - startTime).toFixed(0);
    console.log(`[Background] =====> Bulk import complete in ${duration}ms:`, result);
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
  const progressStatusMessage = (() => {
    const gamesFound = message.gamesFound ?? currentScrapeStatus.gamesFound ?? 0;
    const gamesProcessed = message.gamesProcessed ?? currentScrapeStatus.gamesProcessed ?? 0;
    switch (message.status) {
      case "ready":
        return gamesFound > 0 ? `Found ${gamesFound} game${gamesFound === 1 ? "" : "s"}. Preparing import...` : "Preparing import...";
      case "processing":
        return `Processing games (${gamesProcessed}/${gamesFound})`;
      case "processed":
        return "All games processed. Finalizing...";
      case "loading":
        return `Importing ${gamesFound} game${gamesFound === 1 ? "" : "s"}...`;
      default:
        return "Importing games";
    }
  })();
  await updateScrapeStatus({
    phase: "importing",
    gamesFound: message.gamesFound ?? currentScrapeStatus.gamesFound,
    gamesProcessed: message.gamesProcessed ?? currentScrapeStatus.gamesProcessed,
    duplicates: message.duplicatesSkipped ?? currentScrapeStatus.duplicates,
    statusMessage: progressStatusMessage,
    error: null
  });
  chrome.runtime.sendMessage(message).catch(() => {
  });
  return { success: true };
}
async function handleWordleBotScrapeComplete(message) {
  console.log("[Background] Scrape complete:", message);
  try {
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    await storageService.updateScraperMetadata({
      lastScrape: (/* @__PURE__ */ new Date()).toISOString(),
      lastScrapeMode: "auto",
      // TODO: derive real mode from message when available
      totalScraped: message.totalGames
    });
  } catch (metadataError) {
    console.error("[Background] Failed to update scraper metadata after completion:", metadataError);
  }
  if (scraperTabId) {
    setTimeout(() => {
      if (scraperTabId) {
        chrome.tabs.remove(scraperTabId).catch(() => {
        });
        scraperTabId = null;
      }
    }, 2e3);
  }
  await updateScrapeStatus({
    phase: "complete",
    gamesFound: message.totalGames ?? currentScrapeStatus.gamesFound,
    gamesProcessed: message.totalGames ?? currentScrapeStatus.gamesProcessed,
    newGames: message.newGames ?? currentScrapeStatus.newGames,
    duplicates: message.duplicates ?? currentScrapeStatus.duplicates,
    errors: message.errors ?? currentScrapeStatus.errors,
    statusMessage: message.newGames && message.newGames > 0 ? `Added ${message.newGames} new game${message.newGames === 1 ? "" : "s"}` : "Scrape complete",
    error: null,
    dateRange: message.dateRange ?? currentScrapeStatus.dateRange
  });
  console.log("[Background] Forwarding COMPLETE message to popup");
  try {
    await chrome.runtime.sendMessage(message);
    console.log("[Background] COMPLETE message forwarded successfully");
  } catch (err) {
    console.log("[Background] Could not forward to popup:", err);
  }
  setTimeout(() => {
    updateScrapeStatus({
      phase: "idle",
      gamesFound: 0,
      gamesProcessed: 0,
      newGames: 0,
      duplicates: 0,
      errors: 0,
      statusMessage: "Idle",
      error: null,
      dateRange: null,
      mode: null
    }).catch(() => {
    });
  }, 5e3);
  return { success: true };
}
async function handleWordleBotScrapeError(message) {
  console.error("[Background] Scrape error:", message);
  try {
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    await storageService.updateScraperMetadata({
      lastError: message.error
    });
  } catch (metadataError) {
    console.error("[Background] Failed to update scraper metadata after error:", metadataError);
  }
  if (scraperTabId) {
    chrome.tabs.remove(scraperTabId).catch(() => {
    });
    scraperTabId = null;
  }
  await updateScrapeStatus({
    phase: "error",
    statusMessage: message.error ? `Scrape failed: ${message.error}` : "Scrape failed",
    error: message.error ?? "Unknown error",
    errors: currentScrapeStatus.errors + 1
  });
  chrome.runtime.sendMessage(message).catch(() => {
  });
  return { success: true };
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
  if (timeFrame === "all")
    return games;
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
    if (!game.date)
      return false;
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
      gameCount: 0,
      winCount: 0,
      guessDistribution: [0, 0, 0, 0, 0, 0, 0]
    };
  }
  const getAttemptCount = (game) => {
    if (typeof game.attempts === "number")
      return game.attempts;
    if (typeof game.guesses === "number")
      return game.guesses;
    if (typeof game.steps === "number")
      return game.steps;
    return 0;
  };
  const playedGames = games.filter((game) => getAttemptCount(game) > 0);
  if (playedGames.length === 0) {
    return {
      winRate: 0,
      averageGuesses: 0,
      currentStreak: 0,
      maxStreak: 0,
      gameCount: 0,
      winCount: 0,
      guessDistribution: [0, 0, 0, 0, 0, 0, 0]
    };
  }
  const wins = playedGames.filter((game) => game.won);
  const winRate = wins.length / playedGames.length * 100;
  const totalGuesses = wins.reduce((sum, game) => sum + getAttemptCount(game), 0);
  const averageGuesses = wins.length > 0 ? totalGuesses / wins.length : 0;
  const guessDistribution = [0, 0, 0, 0, 0, 0, 0];
  for (const game of playedGames) {
    const attempts = getAttemptCount(game);
    if (!game.won) {
      guessDistribution[6] = (guessDistribution[6] ?? 0) + 1;
      continue;
    }
    if (attempts >= 1 && attempts <= 6) {
      const index = attempts - 1;
      guessDistribution[index] = (guessDistribution[index] ?? 0) + 1;
    }
  }
  const gamesToUseForStreaks = allGames || games;
  const playedGamesForStreaks = gamesToUseForStreaks.filter(
    (game) => getAttemptCount(game) > 0
  );
  const sortedAllGames = [...playedGamesForStreaks].sort(
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
  console.log(`[BACKGROUND DEBUG] calculateStatistics: Using ${gamesToUseForStreaks.length} games for streaks, ${playedGames.length} played games for other stats`);
  console.log(`[BACKGROUND DEBUG] calculateStatistics: currentStreak=${currentStreak}, maxStreak=${maxStreak}`);
  return {
    winRate,
    averageGuesses,
    currentStreak,
    maxStreak,
    gameCount: playedGames.length,
    winCount: wins.length,
    guessDistribution
  };
}
function compareVersions(version1, version2) {
  const v1parts = version1.split(".").map(Number);
  const v2parts = version2.split(".").map(Number);
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    if (v1part < v2part)
      return -1;
    if (v1part > v2part)
      return 1;
  }
  return 0;
}
async function migrateToV1() {
  console.log("[Background] Migrating to version 1.0.0");
}
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === dashboardTabId) {
    dashboardTabId = null;
  }
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === dashboardTabId && tab.url && !tab.url.includes("dashboard.html")) {
    dashboardTabId = null;
  }
  if (changeInfo.status === "complete" && tab.url && tab.url.includes("dashboard.html")) {
    dashboardTabId = tabId;
  }
});
async function handleOpenDashboardTab(_message) {
  const dashboardUrl = chrome.runtime.getURL("dashboard.html");
  const dashboardPattern = `chrome-extension://${chrome.runtime.id}/dashboard.html*`;
  if (dashboardTabId !== null) {
    try {
      const existingTab = await chrome.tabs.get(dashboardTabId);
      if (existingTab?.url?.startsWith(dashboardUrl) && existingTab.id !== void 0) {
        if (existingTab.windowId !== void 0) {
          await chrome.windows.update(existingTab.windowId, { focused: true });
        }
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.tabs.reload(existingTab.id);
        return { success: true, reused: true, tabId: existingTab.id };
      }
    } catch {
      dashboardTabId = null;
    }
  }
  try {
    const matchingTabs = await chrome.tabs.query({ url: [dashboardPattern] });
    const tabToUse = matchingTabs.find((tab) => tab.id !== void 0);
    if (tabToUse && tabToUse.id !== void 0) {
      dashboardTabId = tabToUse.id;
      if (tabToUse.windowId !== void 0) {
        await chrome.windows.update(tabToUse.windowId, { focused: true });
      }
      await chrome.tabs.update(tabToUse.id, { active: true });
      await chrome.tabs.reload(tabToUse.id);
      return { success: true, reused: true, tabId: tabToUse.id };
    }
  } catch (queryError) {
    errorLog2("[Background] Failed to query dashboard tabs:", queryError);
  }
  const createdTab = await chrome.tabs.create({ url: dashboardUrl });
  dashboardTabId = createdTab.id ?? null;
  return { success: true, reused: false, tabId: createdTab.id ?? void 0 };
}
