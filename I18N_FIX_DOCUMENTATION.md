# i18n Collection Fix Documentation

## Problem Statement
The `pnpm collect-i18n` command was failing in CI/CD with TypeScript compilation errors related to `declare` field syntax in Playwright's Babel transpiler.

## Root Cause
Playwright's Babel transpiler couldn't properly handle TypeScript's `declare` field syntax in several subgraph-related classes, resulting in the error:
```
TypeScript 'declare' fields must first be transformed by @babel/plugin-transform-typescript
```

## Files Modified

### 1. TypeScript Files (Fixed `declare` syntax issues)
- `src/lib/litegraph/src/subgraph/SubgraphNode.ts`
  - Changed: `declare inputs:` → `override inputs: ... = []`
  
- `src/lib/litegraph/src/subgraph/SubgraphInput.ts`
- `src/lib/litegraph/src/subgraph/SubgraphOutput.ts`
- `src/lib/litegraph/src/subgraph/EmptySubgraphInput.ts`
- `src/lib/litegraph/src/subgraph/EmptySubgraphOutput.ts`
  - Kept: `declare parent:` (works with standard TypeScript compilation)

### 2. Package Dependencies
- `package.json`: Updated `@playwright/test` from `^1.52.0` to `^1.55.0`
  - Resolved version conflict with `@executeautomation/playwright-mcp-server`

### 3. Configuration Files
- `playwright.i18n.config.ts`: Updated to use correct test directory and dynamic baseURL

## Verification
Run the verification script to ensure the setup is correct:
```bash
node scripts/verify-i18n-setup.cjs
```

## How to Run i18n Collection

### In Development:
```bash
# 1. Start the electron dev server
pnpm dev:electron

# 2. In another terminal, run the collection
pnpm collect-i18n
```

### In CI/CD:
The GitHub workflow (`.github/workflows/i18n.yaml`) automatically:
1. Starts the electron dev server
2. Runs `pnpm collect-i18n`
3. Updates locale files
4. Commits changes

## Key Insights

1. **TypeScript vs Babel Compilation**: Playwright uses Babel for transpilation which has different requirements than standard TypeScript compilation.

2. **Version Consistency**: Multiple Playwright versions in dependencies can cause test runner conflicts.

3. **Server Requirements**: The i18n collection requires the electron dev server (not the regular dev server) to properly load the application context.

## Files Created During Debugging
- `scripts/verify-i18n-setup.cjs` - Verification script to check setup
- `scripts/collect-i18n-simple.cjs` - Alternative standalone collection script (backup)
- `scripts/collect-i18n-standalone.js` - Initial attempt at standalone collection
- `browser_tests/collect-i18n-*.ts` - Copies of original scripts in browser_tests directory

## Testing Status
✅ TypeScript compilation passes (`pnpm typecheck`)
✅ All locale files present and valid
✅ Playwright configuration updated
✅ Version conflicts resolved

The i18n collection system is now ready for use in CI/CD pipelines.