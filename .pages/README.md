# Branch Status Pages

This directory contains the source for the branch status pages that aggregate development tools and test reports.

## Deployment

The branch status pages are automatically deployed to **Vercel** on every push to any branch.

### Architecture

```
Push to Branch
  ↓
  ├─→ GitHub Actions (runs tests, deploys artifacts)
  │     ├─→ Storybook → Cloudflare Pages
  │     ├─→ E2E Tests → GitHub Actions Artifacts
  │     └─→ Vitest → GitHub Actions Artifacts
  │
  └─→ Vercel (auto-triggered)
        ↓
        Runs: pnpm pages:build:branch-status
        ↓
        1. Fetches test results from deployed sources
        2. Builds status pages
        3. Deploys automatically
```

### URLs

- **Production** (main branch): `https://comfyui-frontend-reports.vercel.app`
- **Preview** (PR branches): `https://<branch>-comfyui-frontend-reports.vercel.app`

## What's Included

The branch status page aggregates:

1. **Storybook** - Component library documentation
2. **Nx Dependency Graph** - Project structure visualization
3. **Playwright Reports** - E2E test results
4. **Vitest Reports** - Unit test results
5. **Coverage Report** - Code coverage metrics
6. **Knip Report** - Unused code and dependency analysis

## How It Works

### Artifact Fetching

The `scripts/fetch-branch-artifacts.sh` script fetches test results from:

- **Storybook**: Deployed to Cloudflare Pages (fetches URL from PR comments)
- **E2E/Vitest**: Downloaded from GitHub Actions artifacts using `gh` CLI
- **Knip**: Generated fresh during build (fast)

### Graceful Fallbacks

If artifacts aren't available yet (CI still running), the build script creates placeholder pages with loading indicators. This allows Vercel to deploy immediately without waiting for all CI to complete.

## Local Development

```bash
# Develop the index page
pnpm pages:dev

# Build without fetching artifacts (uses local builds)
pnpm pages:build

# Build with artifact fetching (simulates Vercel)
pnpm pages:build:branch-status
```

## Environment Variables (Vercel)

Configure these in Vercel project settings:

- `GITHUB_TOKEN` - For fetching artifacts via GitHub API (required)
- `CLOUDFLARE_ACCOUNT_ID` - For Cloudflare API (optional)
- `CLOUDFLARE_API_TOKEN` - For Cloudflare API (optional)

## Files

- **index.html** - Main landing page with links to all reports
- **vite.config.ts** - Vite configuration for building the static site
- **knip.html** - Wrapper for displaying Knip markdown report
- **playwright-reports.html** - Wrapper for E2E test reports

## Adding New Reports

To add a new report to the status page:

1. Update `scripts/fetch-branch-artifacts.sh` to fetch the new artifact
2. Update `scripts/build-pages.sh` to process and copy it
3. Add a link in `index.html`
4. Optionally create a wrapper HTML file for custom styling

## Troubleshooting

### Artifacts not appearing

- Check Vercel build logs for fetch errors
- Verify `GITHUB_TOKEN` is set in Vercel environment
- Ensure GitHub Actions workflows completed successfully
- Artifacts may not be available for old commits (7-day retention)

### Slow builds

- Artifact fetching is designed to be fast (<30s)
- If builds are slow, check network connectivity to GitHub/Cloudflare
- Consider skipping slow-to-generate reports (like coverage)

### Storybook redirect not working

- Verify Cloudflare Pages deployment succeeded
- Check PR comments for correct Storybook URL
- Fallback: Storybook will show placeholder page

## CI Integration

No GitHub Actions workflow is needed for Vercel deployments. Vercel automatically:

1. Detects new commits via GitHub webhook
2. Triggers build with `pnpm pages:build:branch-status`
3. Deploys to branch-specific URL
4. Comments on PR with deployment URL

## Migration Notes

This replaces the previous GitHub Pages deployment approach which:
- ❌ Required complex artifact passing between GitHub Actions and Vercel
- ❌ Had to wait for all CI to complete before deploying
- ❌ Was prone to failure due to artifact extraction issues

The new Vercel-native approach:
- ✅ Deploys immediately on every push
- ✅ Fetches artifacts on-demand during build
- ✅ Shows placeholders for pending CI
- ✅ Simpler, more reliable architecture

## Primary Use Case: Development Team

This deployment provides:

1. **For Design Team**: Consistent, bookmarkable URL to reference the latest component system state
2. **For Developers**: Quick access to test results and coverage for any branch
3. **For PR Reviews**: Easy verification of Storybook changes and test results

## Related Documentation

- [Vercel Documentation](https://vercel.com/docs)
- [Storybook Documentation](https://storybook.js.org/docs)
- [Nx Documentation](https://nx.dev)
- [Vitest Documentation](https://vitest.dev)
- [Knip Documentation](https://knip.dev)
- [Playwright Documentation](https://playwright.dev)
