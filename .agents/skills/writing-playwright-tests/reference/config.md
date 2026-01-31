# Configuration Reference

## Playwright Config

**File:** `playwright.config.ts`

### Key Settings

```typescript
{
  testDir: './browser_tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,  // Fail if .only() left in

  globalSetup: './browser_tests/globalSetup.ts',
  globalTeardown: './browser_tests/globalTeardown.ts',

  // CI vs Local
  retries: process.env.CI ? 3 : 0,
  trace: process.env.CI ? 'on-first-retry' : 'on',
}
```

### Projects

| Project         | Viewport   | Tags               | Use Case       |
| --------------- | ---------- | ------------------ | -------------- |
| `chromium`      | Default    | Excludes `@mobile` | Standard tests |
| `chromium-2x`   | 2x scale   | `@2x` only         | HiDPI tests    |
| `chromium-0.5x` | 0.5x scale | `@0.5x` only       | Low DPI tests  |
| `mobile-chrome` | Pixel 5    | `@mobile` only     | Mobile tests   |

### Timeouts

| Setting                | Value      |
| ---------------------- | ---------- |
| Project timeout        | 15 seconds |
| Global timeout (local) | 30 seconds |

## Environment Variables

| Variable              | Purpose                 | Default                 |
| --------------------- | ----------------------- | ----------------------- |
| `CI`                  | Detected automatically  | -                       |
| `PLAYWRIGHT_LOCAL`    | Enable local dev mode   | unset                   |
| `PLAYWRIGHT_TEST_URL` | Target URL              | `http://localhost:8188` |
| `TEST_COMFYUI_DIR`    | ComfyUI path for backup | unset                   |

## Running Tests

### Local Development

```bash
# UI mode (recommended)
pnpm exec playwright test --ui

# With local settings (more traces)
pnpm test:browser:local

# Headless
pnpm test:browser
```

### Specific Tests

```bash
# By file
pnpm exec playwright test canvas.spec.ts

# By line
pnpm exec playwright test canvas.spec.ts:25

# By grep
pnpm exec playwright test --grep "should pan"
```

### By Tag

```bash
# Run smoke tests
pnpm exec playwright test --grep @smoke

# Skip screenshots
pnpm exec playwright test --grep-invert @screenshot

# Combine
pnpm exec playwright test --grep @canvas --grep-invert @slow
```

### By Project

```bash
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=mobile-chrome
```

## CI Configuration

**File:** `.github/workflows/ci-tests-e2e.yaml`

### Workflow Triggers

- Push to `main`/`master`/`core/*`/`desktop/*`
- Pull requests (except `wip/*`/`draft/*`/`temp/*`)

### Sharding

Chromium tests split across **8 shards** for parallelism.

Other projects run unsharded.

### Server Startup

Backend runs with `--multi-user` flag:

```bash
python3 main.py --cpu --multi-user --front-end-root "$GITHUB_WORKSPACE/dist"
```

### Artifacts

- Blob reports merged to HTML
- Deployed to Cloudflare Pages
- Link posted in PR comment

## Updating Screenshots

### In CI

Add PR label: `New Browser Test Expectations`

Workflow will:

1. Run tests with `--update-snapshots`
2. Commit updated baselines
3. Push to branch

### Locally

**Don't do this** - screenshots are Linux-only.

If you must:

```bash
pnpm exec playwright test --update-snapshots
# Don't commit these!
```

## Global Setup/Teardown

### globalSetup.ts

Backs up user data before tests run (local only).

### globalTeardown.ts

Restores user data after tests complete (local only).

Only runs when `TEST_COMFYUI_DIR` is set.

## Package Scripts

```json
{
  "test:browser": "playwright test",
  "test:browser:local": "PLAYWRIGHT_LOCAL=1 playwright test"
}
```

## Configuration Files

| File                                    | Purpose               |
| --------------------------------------- | --------------------- |
| `playwright.config.ts`                  | Main config           |
| `browser_tests/globalSetup.ts`          | Pre-test setup        |
| `browser_tests/globalTeardown.ts`       | Post-test cleanup     |
| `.github/workflows/ci-tests-e2e.yaml`   | CI workflow           |
| `.github/actions/start-comfyui-server/` | Server startup action |
