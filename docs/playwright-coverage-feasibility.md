# Playwright Code Coverage Feasibility Summary

## Objective

Evaluate approaches for collecting code coverage data from Playwright E2E tests in the ComfyUI frontend project, enabling the team to identify untested code paths exercised during browser-level integration tests.

## Current Project Context

| Aspect                     | Details                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Bundler**                | Vite (via `vitest/config`'s `defineConfig`)                                                                                       |
| **Unit test coverage**     | `@vitest/coverage-v8` already in devDependencies                                                                                  |
| **Playwright tests**       | 59 spec files in `browser_tests/tests/`                                                                                           |
| **Playwright fixture**     | Custom `comfyPageFixture` extending `@playwright/test`'s `base.extend`                                                            |
| **Browser targets**        | Chromium-only (Desktop Chrome, Mobile Chrome, 2x/0.5x scale variants). Firefox/WebKit are commented out in `playwright.config.ts` |
| **Test runner**            | `pnpm test:browser` / `pnpm test:browser:local`                                                                                   |
| **Source maps**            | Enabled by default (`GENERATE_SOURCEMAP !== 'false'`)                                                                             |
| **Build configuration**    | Complex — conditional plugins for Sentry, DevTools, font exclusion, meta injection, etc.                                          |
| **Global setup/teardown**  | Backs up/restores ComfyUI user data; writes perf reports on teardown                                                              |
| **Vitest coverage config** | `coverage: { reporter: ['text', 'json', 'html'] }` in `vite.config.mts`                                                           |

## Approach 1: V8 Coverage via `page.coverage` API

### How It Works

1. Call `page.coverage.startJSCoverage()` before each test navigates to the app.
2. Call `page.coverage.stopJSCoverage()` after each test, receiving raw V8 coverage entries (byte offsets, function ranges).
3. Convert V8 format to Istanbul/lcov using the `v8-to-istanbul` npm package.
4. Merge per-test coverage files and generate reports with `nyc report` or `istanbul`.

### Wrapper Package: `@bgotink/playwright-coverage`

This package wraps the above workflow into a Playwright fixture and reporter:

- Provides a custom `test.extend()` fixture that auto-starts/stops coverage.
- Includes a Playwright reporter that merges and outputs Istanbul-format `.json` files.
- Handles source map resolution for mapping bundled code back to source files.

### Integration Point

The `comfyPageFixture` already extends `base.extend<{ comfyPage: ComfyPage }>`. A coverage fixture would either:

- Wrap `comfyPageFixture` with an additional fixture layer, or
- Be added as a separate fixture composed alongside `comfyPage`.

### Pros

- **No build modifications** — works with the existing production build.
- **Lower runtime overhead** — V8 coverage is built into the engine; no instrumentation step.
- **Simpler setup** — no conditional Vite plugin configuration.
- **Familiar tooling** — team already uses `@vitest/coverage-v8` (same V8 engine).

### Cons

- **Chromium-only** — `page.coverage` is a CDP (Chrome DevTools Protocol) API. If Firefox/WebKit projects are ever enabled, coverage won't work there.
- **Source map accuracy** — V8 reports coverage against bundled code. Source map resolution can produce imprecise mappings, especially with heavily transformed code (Vue SFCs, TypeScript, Tailwind).
- **Bundle-level granularity** — coverage is per-bundle-chunk, not per-source-file. Vendor chunks and code-split modules may produce noisy data.
- **Vue SFC blind spots** — template compilation and `<script setup>` transforms can cause missed or phantom coverage lines.

### Estimated Effort

**1–2 days** to integrate `@bgotink/playwright-coverage` into the existing fixture, configure source map resolution, and generate initial reports.

---

## Approach 2: Istanbul Instrumentation via `vite-plugin-istanbul`

### How It Works

1. Add `vite-plugin-istanbul` to the Vite plugin chain, gated behind an environment variable (e.g., `INSTRUMENT_COVERAGE=true`).
2. The plugin instruments source files at build/serve time with Istanbul counters, exposing `window.__coverage__` at runtime.
3. After each test, collect `window.__coverage__` via `page.evaluate(() => window.__coverage__)` and write it to `.nyc_output/`.
4. Run `nyc report --reporter=html --reporter=lcov` to generate coverage reports.

### Reference Implementation

[mxschmitt/playwright-test-coverage](https://github.com/mxschmitt/playwright-test-coverage) demonstrates this exact pattern with Vite + `vite-plugin-istanbul` + Playwright.

### Integration Point

Add a Playwright fixture that:

```typescript
// coverage-fixture.ts (simplified)
import { test as base } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      // Reset coverage for each context if needed
    })
    await use(context)
  },
  page: async ({ page }, use) => {
    await use(page)
    // Collect coverage after test
    const coverage = await page.evaluate(() => (window as any).__coverage__)
    if (coverage) {
      const outputDir = path.join(process.cwd(), '.nyc_output')
      fs.mkdirSync(outputDir, { recursive: true })
      const id = crypto.randomUUID()
      fs.writeFileSync(
        path.join(outputDir, `${id}.json`),
        JSON.stringify(coverage)
      )
    }
  }
})
```

### Vite Configuration Change

```typescript
// In vite.config.mts — add conditionally
import istanbul from 'vite-plugin-istanbul'

const INSTRUMENT_COVERAGE = process.env.INSTRUMENT_COVERAGE === 'true'

// Add to plugins array:
...(INSTRUMENT_COVERAGE
  ? [istanbul({
      include: 'src/*',
      exclude: ['node_modules', 'browser_tests', 'tests-ui'],
      extension: ['.ts', '.vue'],
      requireEnv: true,
      forceBuildInstrument: true // Also instrument production builds
    })]
  : [])
```

### Pros

- **Cross-browser** — works on any browser Playwright supports (if Firefox/WebKit are ever re-enabled).
- **Source-level accuracy** — instrumentation happens before bundling, so coverage maps directly to original `.ts` and `.vue` files.
- **Vue SFC support** — instruments the compiled output of `<script setup>`, capturing template-driven code paths accurately.
- **Proven pattern** — well-documented reference implementations exist. Standard Istanbul tooling (`nyc`, `istanbul`) for reporting.
- **Mergeable with unit coverage** — both Istanbul and V8 can produce lcov format, enabling merged reports across Vitest unit tests and Playwright E2E tests.

### Cons

- **Build modification required** — adds a conditional Vite plugin, increasing config complexity in an already complex `vite.config.mts`.
- **Performance overhead** — Istanbul instrumentation adds ~10–30% runtime overhead and 2–3× bundle size increase due to injected counter code.
- **Dev server impact** — if used with `pnpm dev`, instrumented code is slower. Must be gated behind an env var.
- **Maintenance burden** — `vite-plugin-istanbul` must stay compatible with Vite version upgrades.
- **CI build time** — instrumented builds take longer; may need a separate CI step or matrix entry.

### Estimated Effort

**2–3 days** to add `vite-plugin-istanbul` with conditional gating, create the coverage collection fixture, integrate with `nyc report`, and verify source mapping accuracy for Vue SFCs.

---

## Side-by-Side Comparison

| Criteria                      | V8 (`@bgotink/playwright-coverage`)      | Istanbul (`vite-plugin-istanbul`)  |
| ----------------------------- | ---------------------------------------- | ---------------------------------- |
| **Browser support**           | Chromium only                            | All browsers                       |
| **Build changes**             | None                                     | Conditional Vite plugin            |
| **Source map accuracy**       | Good (post-bundle)                       | Excellent (pre-bundle)             |
| **Vue SFC coverage**          | Partial (template compilation artifacts) | Full (instruments compiled output) |
| **Runtime overhead**          | Low (~5%)                                | Medium (~10–30%)                   |
| **Bundle size impact**        | None                                     | 2–3× increase when instrumented    |
| **Setup complexity**          | Low                                      | Medium                             |
| **Maintenance**               | Low (Playwright built-in API)            | Medium (plugin compatibility)      |
| **Mergeable with Vitest**     | Yes (via lcov)                           | Yes (via lcov)                     |
| **Existing team familiarity** | High (`@vitest/coverage-v8`)             | Low (new tooling)                  |
| **Estimated effort**          | 1–2 days                                 | 2–3 days                           |

## Risk Assessment

### V8 Approach Risks

1. **Source map resolution failures** — the project uses multiple Vite transforms (Vue SFCs, TypeScript, Tailwind, custom plugins). V8 coverage relies on source maps being accurate after all transforms. Inaccurate maps → misleading coverage data.
2. **Code splitting noise** — the project uses aggressive code splitting (15+ vendor chunks via `rolldownOptions.output.codeSplitting`). Coverage for vendor code will pollute reports unless carefully filtered.
3. **Low risk of breakage** — `page.coverage` is a stable Playwright/CDP API.

### Istanbul Approach Risks

1. **Build config complexity** — `vite.config.mts` is already ~650 lines with many conditional plugins. Adding another conditional plugin increases the surface area for config bugs.
2. **Plugin compatibility** — the project recently migrated to Rolldown (`rolldownOptions`). `vite-plugin-istanbul` may not yet fully support Rolldown's output format. **This requires validation before committing to this approach.**
3. **CI pipeline impact** — instrumented builds will need separate caching and possibly a dedicated CI job to avoid slowing down the main test pipeline.

## Recommendation

### Primary: Istanbul via `vite-plugin-istanbul`

The Istanbul approach is recommended as the primary path for the following reasons:

1. **Source-level accuracy matters** — the project is a large Vue 3 + TypeScript codebase with complex SFC compilation. Pre-bundle instrumentation produces the most trustworthy coverage data.
2. **Vite-native integration** — as a Vite-based project, `vite-plugin-istanbul` integrates naturally with the existing build pipeline.
3. **Future-proof** — if Firefox/WebKit projects are ever re-enabled (they're commented out in `playwright.config.ts`), coverage will continue to work without changes.
4. **Merged reporting** — Istanbul output can be combined with Vitest's existing `@vitest/coverage-v8` output to produce a unified coverage view of unit + E2E tests.

### Fallback: V8 via `@bgotink/playwright-coverage`

If the Istanbul approach encounters blocking issues (e.g., `vite-plugin-istanbul` incompatibility with Rolldown), the V8 approach is a viable fallback:

- Zero build changes needed.
- Quick to prototype (1–2 days).
- Good enough for Chromium-only coverage (which is the current test target).

### Recommended Implementation Path

1. **Validate Rolldown compatibility** — install `vite-plugin-istanbul` and confirm it works with the project's Rolldown-based build. If it doesn't, fall back to V8.
2. **Add conditional instrumentation** — gate behind `INSTRUMENT_COVERAGE=true` env var in `vite.config.mts`.
3. **Create coverage fixture** — extend `comfyPageFixture` to collect `window.__coverage__` after each test and write to `.nyc_output/`.
4. **Add `nyc` report generation** — add a `pnpm test:browser:coverage` script that runs tests with instrumentation, then generates HTML/lcov reports.
5. **CI integration** — add an optional CI job (not on the critical path) that runs instrumented tests and uploads coverage reports.
6. **Merge with unit coverage (stretch goal)** — combine Playwright lcov output with Vitest lcov output for a unified coverage dashboard.

### Suggested Package Additions

```jsonc
// devDependencies
{
  "vite-plugin-istanbul": "^6.0.2",
  "nyc": "^17.1.0"
  // OR for V8 fallback:
  // "@bgotink/playwright-coverage": "^0.3.0",
  // "v8-to-istanbul": "^9.3.0"
}
```

### Suggested Script Additions

```jsonc
// package.json scripts
{
  "test:browser:coverage": "INSTRUMENT_COVERAGE=true pnpm test:browser && nyc report --reporter=html --reporter=lcov --temp-dir=.nyc_output --report-dir=coverage/playwright"
}
```
