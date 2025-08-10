# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (Vue 3 + TypeScript). Key areas: `components/`, `views/`, `stores/` (Pinia), `composables/`, `services/`, `utils/`, `assets/`, `locales/`.
- Routing/i18n/entry: `src/router.ts`, `src/i18n.ts`, `src/main.ts`.
- Tests: unit/component in `tests-ui/` and `src/components/**/*.{test,spec}.ts`; E2E in `browser_tests/`.
- Public assets: `public/`. Build output: `dist/`.
- Config: `vite.config.mts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `.prettierrc`.

## Build, Test, and Development Commands
- `npm run dev`: Start Vite dev server.
- `npm run dev:electron`: Dev server with Electron API mocks.
- `npm run build`: Type-check then production build to `dist/`.
- `npm run preview`: Preview the production build locally.
- `npm run test:unit`: Run Vitest unit tests (`tests-ui/`).
- `npm run test:component`: Run component tests (`src/components/`).
- `npm run test:browser`: Run Playwright E2E tests (`browser_tests/`).
- `npm run lint` / `npm run lint:fix`: Lint (ESLint). `npm run format` / `format:check`: Prettier.
- `npm run typecheck`: Vue TSC type checking.

## Coding Style & Naming Conventions
- Language: TypeScript, Vue SFCs (`.vue`). Indent 2 spaces; single quotes; no semicolons; width 80 (see `.prettierrc`).
- Imports: sorted/grouped by plugin; run `npm run format` before committing.
- ESLint: Vue + TS rules; no floating promises; unused imports disallowed; i18n raw text restrictions in templates.
- Naming: Vue components in PascalCase (e.g., `MenuHamburger.vue`); composables `useXyz.ts`; Pinia stores `*Store.ts`.

## Testing Guidelines
- Frameworks: Vitest (unit/component, happy-dom) and Playwright (E2E).
- Test files: `**/*.{test,spec}.{ts,tsx,js}` under `tests-ui/`, `src/components/`, and `src/lib/litegraph/test/`.
- Coverage: text/json/html reporters enabled; aim to cover critical logic and new features.
- Playwright: place tests in `browser_tests/`; optional tags like `@mobile`, `@2x` are respected by config.

## Commit & Pull Request Guidelines
- Commits: Prefer Conventional Commits (e.g., `feat(ui): add sidebar`), `refactor(litegraph): …`. Use `[skip ci]` for locale-only updates when appropriate.
- PRs: Include clear description, linked issues (`Fixes #123`), and screenshots/GIFs for UI changes. Add/adjust tests and i18n strings when applicable.
- Quality gates: `npm run lint`, `npm run typecheck`, and relevant tests must pass. Keep PRs focused and small.

## Security & Configuration Tips
- Secrets: Use `.env` (see `.env_example`); do not commit secrets.
- Backend: Dev server expects ComfyUI backend at `localhost:8188` by default; configure via `.env`.
