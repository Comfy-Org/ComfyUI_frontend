# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (Vue 3 + TypeScript). Key areas: `components/`, `views/`, `stores/` (Pinia), `composables/`, `services/`, `utils/`, `assets/`, `locales/`.
- Routing/i18n/entry: `src/router.ts`, `src/i18n.ts`, `src/main.ts`.
- Tests: unit/component in `tests-ui/` and `src/components/**/*.{test,spec}.ts`; E2E in `browser_tests/`.
- Public assets: `public/`. Build output: `dist/`.
- Config: `vite.config.mts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.ts`, `.prettierrc`.

## Build, Test, and Development Commands
- `pnpm dev`: Start Vite dev server.
- `pnpm dev:electron`: Dev server with Electron API mocks.
- `pnpm build`: Type-check then production build to `dist/`.
- `pnpm preview`: Preview the production build locally.
- `pnpm test:unit`: Run Vitest unit tests.
- `pnpm test:browser`: Run Playwright E2E tests (`browser_tests/`).
- `pnpm lint` / `pnpm lint:fix`: Lint (ESLint). `pnpm format` / `format:check`: Prettier.
- `pnpm typecheck`: Vue TSC type checking.

## Coding Style & Naming Conventions
- Language: TypeScript, Vue SFCs (`.vue`). Indent 2 spaces; single quotes; no semicolons; width 80 (see `.prettierrc`).
- Imports: sorted/grouped by plugin; run `pnpm format` before committing.
- ESLint: Vue + TS rules; no floating promises; unused imports disallowed; i18n raw text restrictions in templates.
- Naming: Vue components in PascalCase (e.g., `MenuHamburger.vue`); composables `useXyz.ts`; Pinia stores `*Store.ts`.

## Testing Guidelines
- Frameworks: Vitest (unit/component, happy-dom) and Playwright (E2E).
- Test files: `**/*.{test,spec}.{ts,tsx,js}` under `tests-ui/`, `src/components/`, and `src/lib/litegraph/test/`.
- Coverage: text/json/html reporters enabled; aim to cover critical logic and new features.
- Playwright: place tests in `browser_tests/`; optional tags like `@mobile`, `@2x` are respected by config.

## Commit & Pull Request Guidelines
- Commits: Use `[skip ci]` for locale-only updates when appropriate.
- PRs: Include clear description, linked issues (`- Fixes #123`), and screenshots/GIFs for UI changes.
- Quality gates: `pnpm lint`, `pnpm typecheck`, and relevant tests must pass. Keep PRs focused and small.

## Security & Configuration Tips
- Secrets: Use `.env` (see `.env_example`); do not commit secrets.
