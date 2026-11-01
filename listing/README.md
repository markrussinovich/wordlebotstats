# Chrome Web Store Listing Artifacts

This directory contains the marketing copy, asset briefs, and release packaging generated for the Chrome Web Store submission of **Wordle Companion — Play & Stats**. The content reflects guidance from the ["Creating a great listing page" documentation](https://developer.chrome.com/docs/webstore/best-listing).

## Contents

- `store-listing.md` – store title, short summary, feature copy, privacy statement, and support links.
- `store-description.txt` – plain-text long description ready to paste into the store, including historical replay and today's NYT gameplay limitations.
- `asset-plan.md` – requirements and creative guidance for icons, screenshots, and promotional images, including recommended capture scenes and status tracking.
- `checklist.md` – publication checklist covering pre-submission QA, asset verification, policy compliance, and release messaging.
- `assets/` – current screenshots and promotional images generated from the extension with synthetic demo history, plus capture guidance.
- `latest-build/` – populated automatically once `npm run build:quick` (or `node scripts/quick-build-extension.js`) finishes. Contains a versioned ZIP that you can upload to the Chrome Web Store dashboard.

Current submission package: `latest-build/wordle-companion-1.1.1.zip`.

## How to use

1. Finalize screenshots and promotional art following the specifications in `asset-plan.md`, then drop the exported files into `listing/assets/`.
2. Copy the text from `store-listing.md` into the Chrome Web Store developer dashboard. Adjust localization-specific fields as needed.
3. Run the quick build script to generate a fresh extension bundle and upload the resulting ZIP from `listing/latest-build/`.
4. Walk through `checklist.md` before you hit publish to catch any last-minute issues.

To regenerate the current screenshots and promotional assets, build the extension, then run:

```powershell
npx tsx --tsconfig config\tsconfig.json scripts\capture-listing-screenshots.ts
```

This uses synthetic demo history in an isolated Chromium profile, not personal browser data. It does not upload assets, publish the listing, or play today's NYT game.

These assets are intentionally stored outside of the compiled extension to keep marketing materials versioned alongside source code. Feel free to extend this directory with localization folders, changelog drafts, or A/B testing variants as the product grows.
