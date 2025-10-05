/**
 * Debug helper to remove imported Wordle games from local extension storage.
 *
 * Usage:
 * 1. Open `chrome://extensions/` in Chrome.
 * 2. Click the "service worker" link under the Wordle Stats extension to open its console.
 * 3. Paste the contents of this file into the console and press Enter.
 *
 * The script clears:
 * - IndexedDB `games` object store (where downloaded games are persisted).
 * - Metadata entries that track the WordleBot scraper cooldown.
 * - Cached game lists held in `chrome.storage.local`.
 *
 * After the script finishes you can reopen the popup to trigger a fresh import
 * and verify the game loading flow from a clean state.
 */
(async () => {
  const DB_NAME = 'wordleStatsDB';
  const GAMES_STORE = 'games';
  const METADATA_STORE = 'metadata';
  const METADATA_KEYS_TO_CLEAR = ['wordleBotScraper', 'lastBulkImport'];
  const LOCAL_STORAGE_KEYS = ['games', 'gamesCache', 'lastCacheUpdate'];
  const SYNC_STORAGE_KEYS = ['lastSyncTime', 'lastImportTime'];

  console.group('[Wordle Debug] Clearing downloaded games...');

  try {
    const db = await openDatabase(DB_NAME);

    if (db) {
      if (db.objectStoreNames.contains(GAMES_STORE)) {
        const beforeCount = await countStoreEntries(db, GAMES_STORE);
        await clearStore(db, GAMES_STORE);
        const afterCount = await countStoreEntries(db, GAMES_STORE);
        console.info(
          `IndexedDB cleared for store "${GAMES_STORE}" (before: ${beforeCount}, after: ${afterCount}).`
        );
      } else {
        console.warn(
          `IndexedDB database "${DB_NAME}" does not contain the "${GAMES_STORE}" store. Skipping store clear.`
        );
      }

      if (db.objectStoreNames.contains(METADATA_STORE)) {
        for (const metaKey of METADATA_KEYS_TO_CLEAR) {
          const removed = await deleteKeyFromStore(db, METADATA_STORE, metaKey);
          if (removed) {
            console.info(`Removed metadata entry "${metaKey}".`);
          }
        }
      }

      db.close();
    } else {
      console.info('IndexedDB database not found. Nothing to clear.');
    }
  } catch (error) {
    console.error('Failed to clear IndexedDB data:', error);
  }

  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      const removedLocal = await removeStorageKeys(chrome.storage.local, LOCAL_STORAGE_KEYS);
      if (removedLocal.length) {
        console.info('Removed chrome.storage.local keys:', removedLocal.join(', '));
      }

      const removedSync = await removeStorageKeys(chrome.storage.sync, SYNC_STORAGE_KEYS);
      if (removedSync.length) {
        console.info('Removed chrome.storage.sync keys:', removedSync.join(', '));
      }
    } catch (error) {
      console.error('Failed to clear chrome.storage keys:', error);
    }
  } else {
    console.warn('chrome.storage is not available in this context; skipped storage cleanup.');
  }

  console.groupEnd();
  console.log('[Wordle Debug] Game data cleared. Reopen the popup to trigger a fresh load.');
})();

async function openDatabase(name) {
  if (typeof indexedDB?.open !== 'function') {
    console.warn('IndexedDB not available; skipping database cleanup.');
    return null;
  }

  try {
    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      const exists = databases.some((dbInfo) => dbInfo.name === name);
      if (!exists) {
        return null;
      }
    }
  } catch (error) {
    console.warn('Unable to list IndexedDB databases; proceeding with open attempt.', error);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);

    request.onerror = () => {
      reject(request.error || new Error(`Failed to open database "${name}".`));
    };

    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.length) {
        // Database was created but stores are missing (likely a fresh DB). Delete it to avoid leaving an empty shell.
        db.close();
        indexedDB.deleteDatabase(name);
        resolve(null);
        return;
      }
      resolve(db);
    };

    request.onupgradeneeded = () => {
      // If we trigger an upgrade because the database doesn't exist yet, abort the creation so we don't leave empty stores.
      const db = request.result;
      if (!db.objectStoreNames.length) {
        request.transaction?.abort();
      }
    };
  });
}

function countStoreEntries(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();

    request.onsuccess = () => resolve(request.result || 0);
    request.onerror = () => reject(request.error || new Error(`Failed to count store "${storeName}".`));
  });
}

function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(request.error || new Error(`Failed to clear store "${storeName}".`));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error(`Transaction failed while clearing "${storeName}".`));
  });
}

async function deleteKeyFromStore(db, storeName, key) {
  if (!db.objectStoreNames.contains(storeName)) {
    return false;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error(`Failed to delete key "${key}" from store "${storeName}".`));
    tx.onabort = () => reject(tx.error || new Error(`Transaction aborted while deleting "${key}".`));
  });
}

async function removeStorageKeys(area, keys) {
  if (!area || !keys.length) {
    return [];
  }

  const existing = await new Promise((resolve, reject) => {
    area.get(keys, (items) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(items || {});
    });
  });

  const presentKeys = keys.filter((key) => existing[key] !== undefined);
  if (!presentKeys.length) {
    return [];
  }

  await new Promise((resolve, reject) => {
    area.remove(presentKeys, () => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });

  return presentKeys;
}
