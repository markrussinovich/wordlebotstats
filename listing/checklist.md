# Pre-Publication Checklist

Use this checklist before submitting **Wordle Stat Explorer** to the Chrome Web Store. Update the status column as you complete each step.

| Step | Status | Owner | Notes |
| --- | --- | --- | --- |
| Verify manifest version matches marketing copy | ☐ |  | `src/extension/manifest.json` and package description |
| Run unit tests (`npm test`) | ☐ |  | Ensure green tests before packaging |
| Run quick build script (`npm run build:quick`) | ☐ |  | Produces production assets in `dist/` and `listing/latest-build/` zip |
| Manually smoke-test extension from `dist/` | ☐ |  | Check popup import, dashboard charts, NYT login messaging |
| Capture/update screenshots in `listing/assets/` | ☐ |  | Follow `asset-plan.md` dimensions |
| Export promo tile (440×280) | ☐ |  | Maintain brand gradient and legible text |
| Update store listing copy in `store-listing.md` if features changed | ☐ |  | Review summary (≤132 chars) and description |
| Confirm privacy statement matches data usage | ☐ |  | Update if data practices change |
| Provide support URL and contact method | ☐ |  | e.g., GitHub issues or support email |
| Double-check policies (spam, metadata, impersonation) | ☐ |  | See Chrome Web Store Program Policies |
| Upload zip to developer dashboard, save draft | ☐ |  | Use `listing/latest-build/wordle-stat-explorer-<version>.zip` |
| Submit for review | ☐ |  | Include release notes in dashboard |

## Release notes guidance

- Highlight fixes or new charts in 1–2 bullet points.
- Mention any onboarding tweaks (e.g., improved NYT login detection).
- Link back to docs or GitHub for detailed changelog if desired.

## Support & Contact

- Primary support: <https://github.com/markrussinovich/wordlebotstats/issues>
- Optional email alias: `wordlestatupport@example.com` (replace with real inbox before launch).

Keep the checklist with the repository so future releases stay consistent and auditable.
