# Listing Asset Staging

Place final, production-ready images for the Chrome Web Store here. Keep filenames lowercase and descriptive so it’s clear which asset belongs to which field in the developer dashboard.

Suggested naming convention:

- `icon-128.png`
- `screenshot-01-overview.png`
- `screenshot-02-comparisons.png`
- `screenshot-03-solver-games.png`
- `screenshot-04-popup.png` - historical replay and today's NYT connection controls
- `screenshot-05-play.png` - dedicated puzzle picker, board, and keyboard
- `promo-tile-440x280.png`
- `marquee-1400x560.png`

> Tip: When new locales are added, create subdirectories such as `locales/es` that mirror the screenshot names in Spanish.

The five store screenshots are 1280x800 RGB PNGs. `popupanddashboard.png` is the README composite; its copy in `resized/` is kept current. The promo tile and marquee also use the current UI and gameplay copy.

To reproduce all images from the current extension build using an isolated Chromium profile and synthetic demo history:

```powershell
npm run build:extension
npx tsx --tsconfig config\tsconfig.json scripts\capture-listing-screenshots.ts
```

The capture does not use personal records, sign into NYT, or submit today's game. Today's screenshots show the connection controls; historical replay screenshots use demo puzzle data. Colors are taken from the extension's theme variables, and generated PNGs have no alpha channel.

After exporting assets, review each image and update the status table in `../asset-plan.md`.
