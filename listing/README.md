# Chrome Web Store Listing Artifacts

This directory contains the marketing copy, asset briefs, and release packaging generated for the Chrome Web Store submission of **Wordle Stat Explorer**. The content reflects guidance from the ["Creating a great listing page" documentation](https://developer.chrome.com/docs/webstore/best-listing).

## Contents

- `store-listing.md` – polished copy for the store title, summary, detailed description, feature bullets, privacy statement, and support links.
- `asset-plan.md` – requirements and creative guidance for icons, screenshots, and promotional images, including recommended capture scenes and status tracking.
- `checklist.md` – publication checklist covering pre-submission QA, asset verification, policy compliance, and release messaging.
- `assets/` – subdirectory reserved for export-ready images. Currently includes briefs for each required asset and placeholders until final art is produced.
- `latest-build/` – populated automatically once `npm run build:quick` (or `node scripts/quick-build-extension.js`) finishes. Contains a versioned ZIP that you can upload to the Chrome Web Store dashboard.

## How to use

1. Finalize screenshots and promotional art following the specifications in `asset-plan.md`, then drop the exported files into `listing/assets/`.
2. Copy the text from `store-listing.md` into the Chrome Web Store developer dashboard. Adjust localization-specific fields as needed.
3. Run the quick build script to generate a fresh extension bundle and upload the resulting ZIP from `listing/latest-build/`.
4. Walk through `checklist.md` before you hit publish to catch any last-minute issues.

These assets are intentionally stored outside of the compiled extension to keep marketing materials versioned alongside source code. Feel free to extend this directory with localization folders, changelog drafts, or A/B testing variants as the product grows.
