# Asset Plan for Chrome Web Store

The Chrome Web Store listing relies on a cohesive set of visual assets. Use this plan to track production and ensure everything adheres to Google's guidance on sizes, clarity, and branding consistency.

| Asset              | Dimensions         | Format          | Status                               | Notes                                                                                                                                                   |
| ------------------ | ------------------ | --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store icon         | 128 × 128 px (PNG) | Transparent PNG | ☐ To capture                         | Use the existing extension icon, ensure crisp edges, no screenshots or small text. Export at 128×128 and 48×48 for internal testing.                    |
| Screenshot 1       | 1280 × 800 px      | PNG             | ☑ Complete (1.1.1 branding refresh) | `assets/screenshot-01-overview.png`: dashboard totals, head-to-head stats, and timeline vs solver and NYT readers.                                      |
| Screenshot 2       | 1280 × 800 px      | PNG             | ☑ Complete (1.1.1 branding refresh) | `assets/screenshot-02-comparisons.png`: last-30-days individual-game timeline with solver and NYT reader comparisons.                                   |
| Screenshot 3       | 1280 × 800 px      | PNG             | ☑ Complete (1.1.1 branding refresh) | `assets/screenshot-03-solver-games.png`: Show unplayed, three embedded boards, shared replay progress, keyboards, and played-game comparison summaries. |
| Screenshot 4       | 1280 × 800 px      | PNG             | ☑ Complete (1.1.1 branding refresh) | `assets/screenshot-04-popup.png`: historical replay and today's NYT connection controls in equally sized popups.                                        |
| Screenshot 5       | 1280 × 800 px      | PNG             | ☑ Complete (1.1.1 branding refresh) | `assets/screenshot-05-play.png`: dedicated puzzle dropdown, direct tile entry, shared progress, and keyboard.                                           |
| Promo tile (small) | 440 × 280 px       | PNG             | ☑ Complete (1.1.1 branding refresh) | `assets/promo-tile-440x280.png`: Wordle tiles, Companion name, and "Play. Compare. Explore." 24-bit, no alpha.                                          |
| Marquee image      | 1400 × 560 px      | PNG             | ☑ Complete (1.1.1 branding refresh) | `assets/marquee-1400x560.png`: Companion / Play & Stats branding with actual dashboard and replay-popup captures. 24-bit, no alpha.                     |

## Capture guidelines

- **No alpha channel**: The store accepts JPEG or 24-bit PNG only. Playwright output can be RGBA, so flatten to RGB (e.g. Pillow `convert("RGB")`) before uploading.
- **Keep screenshots full-bleed**: No borders or rounded corners. Use square corners, true 1280×800 layout.
- **Stay current**: Re-capture whenever UI or styling changes significantly.
- **Consistent theming**: Use colors from the extension's `--cp-*` theme variables and Segoe UI typography for promotional graphics.
- **Avoid promotional claims**: No “#1” badges, editor-callouts, or misleading text.

## Workflow

1. Run `npm run build:extension`, then `npx tsx --tsconfig config\tsconfig.json scripts\capture-listing-screenshots.ts`.
2. The generator loads the real unpacked extension in a temporary Chromium profile, seeds synthetic history and demo past-puzzle data, and enters replay guesses through the real UI. Today's panel remains unconnected: no NYT account or official game is used.
3. Review all five 1280x800 screenshots. The generator also refreshes the README composite, its `resized/` copy, the 440x280 promo tile, and the 1400x560 marquee.
4. Images are flattened to RGB PNGs. Theme colors come from the extension's CSS variables. Mark assets complete only after checking the rendered output and dimensions.

## Future enhancements

- Add localized screenshot variants (`listing/assets/locales/<locale>/`).
- Produce an explainer GIF or short video for the developer dashboard (optional but helpful).
- Track A/B testing results for summaries and screenshots in an adjacent `listing/experiments/` folder.
