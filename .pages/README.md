# Branch Status Pages

This directory contains the source for branch status pages deployed to **Cloudflare Pages**.

## Architecture

```
Push to Branch
  |
  +-> GitHub Actions (runs tests, deploys artifacts)
  |     +-> Storybook -> comfy-storybook.pages.dev
  |     +-> E2E Tests -> comfyui-playwright-*.pages.dev
  |     +-> Branch Status -> comfyui-frontend-reports.pages.dev
  |
  +-> deploy-branch-status.yml
        |
        Runs: pnpm pages:build
        |
        Deploys to Cloudflare Pages via wrangler
```

## URLs

- **Production** (main branch): `https://comfyui-frontend-reports.pages.dev`
- **Preview** (PR branches): `https://<branch>.comfyui-frontend-reports.pages.dev`

## What's Included

1. **Storybook** - Links to Cloudflare Pages deployment
2. **Nx Dependency Graph** - Generated during build
3. **Playwright Reports** - Links to Cloudflare Pages deployments
4. **Vitest Reports** - Links to CI artifacts
5. **Coverage Report** - Links to CI artifacts
6. **Knip Report** - Generated fresh during build

## Local Development

```bash
pnpm pages:dev     # Dev server
pnpm pages:build   # Build
```

## Secrets

Required in GitHub Actions:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Files

- **index.html** - Landing page with links to all reports
- **vite.config.ts** - Vite config for building the static site
- **knip.html** - Knip markdown report viewer
- **playwright-reports.html** - E2E test report viewer
