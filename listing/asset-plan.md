# Asset Plan for Chrome Web Store

The Chrome Web Store listing relies on a cohesive set of visual assets. Use this plan to track production and ensure everything adheres to Google's guidance on sizes, clarity, and branding consistency.

| Asset | Dimensions | Format | Status | Notes |
| --- | --- | --- | --- | --- |
| Store icon | 128 × 128 px (PNG) | Transparent PNG | ☐ To capture | Use the existing extension icon, ensure crisp edges, no screenshots or small text. Export at 128×128 and 48×48 for internal testing. |
| Screenshot 1 | 1280 × 800 px | PNG | ☐ To capture | Dashboard overview with win rate, streak, and WordleBot comparison visible. Use light mode with authentic data; crop to remove browser UI. |
| Screenshot 2 | 1280 × 800 px | PNG | ☐ To capture | Auto-import flow showing spinner and NYT login guidance. Demonstrate the popup collecting data. |
| Screenshot 3 | 1280 × 800 px | PNG | ☐ To capture | Trend timeline showcasing performance over time with tooltips. Highlight comparison to national average. |
| Screenshot 4 | 1280 × 800 px | PNG | ☐ Optional | Optional stager showing benchmarking view or preferences panel. |
| Screenshot 5 | 1280 × 800 px | PNG | ☐ Optional | Optional advanced analytics (guess distribution chart) once available. |
| Promo tile (small) | 440 × 280 px | PNG | ☐ To design | Bold gradient background with logo and short tagline: “Understand your Wordle streak”. Minimal text, align with icon palette. |
| Marquee image | 1400 × 560 px | PNG | ☐ Optional | Wide-format hero; include product mockup and CTA “Compare with WordleBot”. Keep margins, avoid clutter. |

## Capture guidelines

- **Keep screenshots full-bleed**: No borders or rounded corners. Use square corners, true 1280×800 layout.
- **Stay current**: Re-capture whenever UI or styling changes significantly.
- **Consistent theming**: Use the brand gradient (#6AAA64 → #538D4E) for promo graphics. Align fonts with the in-product typography where legally permissible.
- **Avoid promotional claims**: No “#1” badges, editor-callouts, or misleading text.

## Workflow

1. Stage representative data by running the extension locally and importing sample games (`tests/fixtures/sample-wordle-data.json` if needed).
2. Capture PNGs using a high-DPI display. Verify they remain sharp when viewed at 50% scale.
3. Optimize files (ImageOptim or `pnpm imagemin` equivalent) before committing to keep repository size manageable.
4. Place final assets in `listing/assets/` and mark the table above as complete.

## Future enhancements

- Add localized screenshot variants (`listing/assets/locales/<locale>/`).
- Produce an explainer GIF or short video for the developer dashboard (optional but helpful).
- Track A/B testing results for summaries and screenshots in an adjacent `listing/experiments/` folder.
