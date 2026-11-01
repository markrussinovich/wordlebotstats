# Privacy Policy - Wordle Companion — Play & Stats

**Last updated: November 1, 2026**

## Overview

**Wordle Companion respects your privacy and operates with complete transparency.**

Wordle Companion is a browser extension for playing unplayed Wordle puzzles and analyzing your Wordle game performance. This privacy policy explains what data the extension uses and stores, and how its NYT interactions work.

## Data Collection

Wordle Companion collects only the data necessary to provide statistics about your Wordle games:

- **Wordle game results**: Puzzle numbers, dates, guess counts, board states, and win/loss status
- **WordleBot metrics**: Skill and luck scores when available from the NYTimes WordleBot page
- **User preferences**: Display settings, dashboard filters, and time range selections
- **Extension gameplay**: Selected puzzle dates, drafts, scored guesses, replay answers, completion state, and the tab identifier used to connect to today's NYT board

## Data Storage and Security

All data is stored **locally on your device** using Chrome's `chrome.storage.local` API:

- ✅ **No extension-operated cloud service**: History, preferences, caches, and extension gameplay progress are stored locally
- ✅ **No analytics or tracking**: No analytics, tracking pixels, telemetry, or usage monitoring
- ✅ **No separate extension account**: The extension does not collect passwords or create an account; NYT features use your existing browser session and NYT access
- ✅ **Your control**: All data remains under your complete control on your device

## Permissions

The extension requests only the minimal permissions needed to function:

- **Storage**: To save game history, preferences, caches, and extension gameplay sessions locally
- **NYT host permissions**: To import WordleBot history, retrieve puzzle answers for past replays and reader summaries, and interact with the real NYT game for today's guesses
- **activeTab**: To access the currently active tab so the popup can display the right stats context
- **tabs**: To find or open Wordle and WordleBot tabs, coordinate imports, and connect extension gameplay to today's NYT board

## Data Sharing

We do not sell or rent your data, send it to an extension-operated service, or add analytics or tracking.

The extension makes requests to NYT for available WordleBot history, per-puzzle reader summaries, and historical puzzle answers. Those requests are subject to NYT's own policies. Reader-summary and historical-answer requests do not upload your stored game history.

Past replays are scored locally and do not upload results to NYT or alter official history. Today's guesses are different: the extension sends them to the actual NYT game tab and reads that site's feedback. NYT handles those guesses and its own persistence using your browser's NYT session. The extension does not guarantee signed-in account synchronization. Imported results remain separate from extension gameplay progress.

## Data Retention

Your data is stored locally on your device for as long as:

- The extension is installed, or
- You manually delete your browser data/extension data

You can delete all stored data at any time by:

- Removing the extension from your browser
- Using your browser's "Clear browsing data" feature
- Using the data management features within the extension dashboard

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last updated" date at the top of this policy.

## Contact

For questions about this privacy policy or the extension, please create an issue in our [GitHub repository](https://github.com/markrussinovich/wordlecompanion/issues).

## Source Code

This extension is open source. You can review the complete source code to verify our privacy practices at: https://github.com/markrussinovich/wordlecompanion
