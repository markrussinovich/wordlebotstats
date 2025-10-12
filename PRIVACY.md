# Privacy Policy - Wordle Stat Explorer

**Last updated: October 12, 2025**

## Overview

**Wordle Stat Explorer respects your privacy and operates with complete transparency.**

Wordle Stat Explorer is a browser extension that helps you track and analyze your Wordle game performance. This privacy policy explains what data we collect, how we use it, and how we protect your privacy.

## Data Collection

Wordle Stat Explorer collects only the data necessary to provide statistics about your Wordle games:

- **Wordle game results**: Puzzle numbers, dates, guess counts, board states, and win/loss status
- **WordleBot metrics**: Skill and luck scores when available from the NYTimes WordleBot page
- **User preferences**: Display settings, dashboard filters, and time range selections

## Data Storage and Security

All data is stored **locally on your device** using Chrome's `chrome.storage.local` API:

- ✅ **No external servers**: No data is ever transmitted to external servers, databases, or cloud services
- ✅ **No analytics or tracking**: No analytics, tracking pixels, telemetry, or usage monitoring
- ✅ **No user accounts**: No authentication, user accounts, or cloud synchronization
- ✅ **Your control**: All data remains under your complete control on your device

## Permissions

The extension requests only the minimal permissions needed to function:

- **Storage**: To save your game history and preferences locally on your device
- **Host permissions for `*.nytimes.com`**: To read your Wordle game data from the NYTimes website when you visit the Wordle Bot page
- **Scripting**: To inject content scripts that extract game data from the NYTimes pages you visit

## Data Sharing

We do not share, sell, rent, or otherwise distribute your data to any third parties. Your Wordle game data never leaves your device.

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

For questions about this privacy policy or the extension, please create an issue in our [GitHub repository](https://github.com/markrussinovich/wordlebotstats/issues).

## Source Code

This extension is open source. You can review the complete source code to verify our privacy practices at: https://github.com/markrussinovich/wordlebotstats