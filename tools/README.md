# Development Tools

This directory contains development utilities, debugging scripts, and test tools that are used during development but are not part of the main build or test suite.

## Contents

### Test Utilities
- `test-*.js` - Various testing and debugging scripts
- `test-*.cjs` - CommonJS test modules
- `test-*.spec.ts` - TypeScript test specifications

### Debug Tools
- `debug-*.js` - Debugging utilities
- `inspect-*.js` - Inspection and analysis tools
- `check-*.js` - Validation scripts

### Build Tools
- `build-*.js` - Build-related utilities
- `verify-changes.ps1` - PowerShell verification script

## Usage

These tools are meant for manual execution during development:

```bash
# Example: Run a test utility
node tools/test-wordle-bot-live.js

# Example: Debug extension
node tools/test-extension-debug.js
```

**Note**: These tools are not part of the automated test suite or build process.
