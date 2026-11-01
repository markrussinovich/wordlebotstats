# Pre-Publication Checklist

Use this checklist before submitting **Wordle Companion — Play & Stats** to the Chrome Web Store. Update the status column as you complete each step.

| Step                                                                | Status | Owner | Notes                                                                 |
| ------------------------------------------------------------------- | ------ | ----- | --------------------------------------------------------------------- |
| Verify manifest version matches marketing copy                      | ☐      |       | `src/extension/manifest.json` and package description                 |
| Run unit tests (`npm test`)                                         | ☐      |       | Ensure green tests before packaging                                   |
| Run quick build script (`npm run build:quick`)                      | ☐      |       | Produces production assets in `dist/` and `listing/latest-build/` zip |
| Manually smoke-test extension from `dist/`                          | ☐      |       | Check popup import, dashboard charts, NYT login messaging             |
| Capture/update screenshots in `listing/assets/`                     | ☐      |       | Follow `asset-plan.md` dimensions                                     |
| Export promo tile (440×280)                                         | ☐      |       | Maintain brand gradient and legible text                              |
| Update store listing copy in `store-listing.md` if features changed | ☐      |       | Review summary (≤132 chars) and description                           |
| Confirm privacy statement matches data usage                        | ☐      |       | Update if data practices change                                       |
| Provide support URL and contact method                              | ☐      |       | e.g., GitHub issues or support email                                  |
| Double-check policies (spam, metadata, impersonation)               | ☐      |       | See Chrome Web Store Program Policies                                 |
| Upload zip to developer dashboard, save draft                       | ☐      |       | Use `listing/latest-build/wordle-companion-<version>.zip`             |
| Submit for review                                                   | ☐      |       | Include release notes in dashboard                                    |

## Release notes guidance

- Highlight fixes or new charts in 1–2 bullet points.
- Mention any onboarding tweaks (e.g., improved NYT login detection).
- Link back to docs or GitHub for detailed changelog if desired.

### 1.1.1

- Renamed to Wordle Companion — Play & Stats, with consistent popup, dashboard, play-view, and store branding. Existing saved games and sessions remain compatible.
- Play unplayed dates directly in the popup, dashboard tiles, or a persistent pop-out. Shared drafts and guesses, tile-entry pops, staggered feedback flips, and invalid-guess shakes.
- Browse blank and missing dates with Show unplayed, popup arrows/Left-Right keys, or the dedicated puzzle picker. Existing user games remain read-only.
- Historical replays are local; today's guesses use the real NYT game tab and official feedback. Replays do not update NYT history.
- Local WordleBot-style solver: see its normal-mode heuristic turn count and guess path in the dashboard and popup; not a globally optimal solver.
- Compare every game and your trend with NYT reader averages, including "vs Solver" and "vs NYT Readers" stats for any date range.
- Reliable backfill of missed games, a refreshed NYT Wordle look, and popup navigation that jumps back to the latest game.

## Support & Contact

- Primary support: <https://github.com/markrussinovich/wordlecompanion/issues>
- Optional email alias: `wordlestatupport@example.com` (replace with real inbox before launch).

Keep the checklist with the repository so future releases stay consistent and auditable.
