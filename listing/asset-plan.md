# Asset Plan for Chrome Web Store

The Chrome Web Store listing relies on a cohesive set of visual assets. Use this plan to track production and ensure everything adheres to Google's guidance on sizes, clarity, and branding consistency.

| Asset | Dimensions | Format | Status | Notes |
| --- | --- | --- | --- | --- |
| Store icon | 128 × 128 px (PNG) | Transparent PNG | ☐ To capture | Use the existing extension icon, ensure crisp edges, no screenshots or small text. Export at 128×128 and 48×48 for internal testing. |
| Screenshot 1 | 1280 × 800 px | PNG | ☑ Complete (1.1.0) | `assets/screenshot-01-overview.png`: dashboard totals, head-to-head stats, and timeline vs solver and NYT readers. |
| Screenshot 2 | 1280 × 800 px | PNG | ☑ Complete (1.1.0) | `assets/screenshot-02-comparisons.png`: narrowed timeline range with updated comparisons and turn distribution. |
| Screenshot 3 | 1280 × 800 px | PNG | ☑ Complete (1.1.0) | `assets/screenshot-03-solver-games.png`: individual game tiles with an expanded solver path. |
| Screenshot 4 | 1280 × 800 px | PNG | ☑ Complete (1.1.0) | `assets/screenshot-04-popup.png`: popup showing the user's board and the solver's board side by side. |
| Screenshot 5 | 1280 × 800 px | PNG | ☐ Optional | Optional dark-mode variant. |
| Promo tile (small) | 440 × 280 px | PNG | ☑ Complete (1.1.0) | `assets/promo-tile-440x280.png`: Wordle tiles, name, and "You vs. NYT readers vs. a solver". 24-bit, no alpha. |
| Marquee image | 1400 × 560 px | PNG | ☑ Complete (1.1.0) | `assets/marquee-1400x560.png`: tagline with dashboard and popup mockups. 24-bit, no alpha. |

## Capture guidelines

- **No alpha channel**: The store accepts JPEG or 24-bit PNG only. Playwright output can be RGBA, so flatten to RGB (e.g. Pillow `convert("RGB")`) before uploading.
- **Keep screenshots full-bleed**: No borders or rounded corners. Use square corners, true 1280×800 layout.
- **Stay current**: Re-capture whenever UI or styling changes significantly.
- **Consistent theming**: Use the brand gradient (#6AAA64 → #538D4E) for promo graphics. Align fonts with the in-product typography where legally permissible.
- **Avoid promotional claims**: No “#1” badges, editor-callouts, or misleading text.

## Workflow

1. Stage representative synthetic data (never personal game history). The 1.1.0 screenshots use deterministic demo games rendered from `dist/` with stubbed extension APIs.
2. Capture PNGs using a high-DPI display. Verify they remain sharp when viewed at 50% scale.
3. Optimize files (ImageOptim or `pnpm imagemin` equivalent) before committing to keep repository size manageable.
4. Place final assets in `listing/assets/` and mark the table above as complete.

## Future enhancements

- Add localized screenshot variants (`listing/assets/locales/<locale>/`).
- Produce an explainer GIF or short video for the developer dashboard (optional but helpful).
- Track A/B testing results for summaries and screenshots in an adjacent `listing/experiments/` folder.
