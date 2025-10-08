# Configuration Files

This directory contains all build and tooling configuration files.

## Contents

### Build Configuration
- `vite.config.ts` - Main Vite build configuration
- `vite.config.popup.ts` - Popup-specific Vite configuration
- `vite.config.dashboard.ts` - Dashboard-specific Vite configuration

### TypeScript Configuration
- `tsconfig.json` - Main TypeScript configuration
- `tsconfig.node.json` - Node.js TypeScript configuration

### Testing Configuration
- `jest.config.js` - Jest unit testing configuration
- `playwright.config.ts` - Playwright E2E testing configuration

### Code Quality
- `.eslintrc.js` - ESLint linting rules
- `.prettierrc` - Prettier code formatting rules

## Usage

These configuration files are automatically used by their respective tools. Reference them explicitly when needed:

```bash
# Using configs from package.json scripts
npm run build          # Uses vite.config.ts
npm test              # Uses jest.config.js
npm run test:e2e      # Uses playwright.config.ts
npm run lint          # Uses .eslintrc.js
```
