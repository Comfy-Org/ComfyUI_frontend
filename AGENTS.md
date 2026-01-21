# ComfyUI Frontend

Vue 3.5+ / TypeScript / Tailwind 4 frontend for ComfyUI. Uses Nx monorepo with pnpm.

## Commands

```bash
pnpm dev              # Vite dev server
pnpm build            # Type-check + production build
pnpm typecheck        # Vue TSC
pnpm lint             # ESLint
pnpm format           # oxfmt
pnpm test:unit        # Vitest
pnpm test:browser     # Playwright E2E
pnpm knip             # Dead code detection
```

## Project Structure

- `src/` — Main application (components, views, stores, composables, services, utils)
- `browser_tests/` — Playwright E2E tests (`*.spec.ts`)
- `packages/` — Shared packages (design-system, etc.)
- `docs/guidance/` — File-type conventions (auto-loaded by glob)
- `docs/testing/` — Testing patterns and examples

## Key Conventions

See `docs/guidance/*.md` for file-specific rules. Quick reference:

- **Vue**: Composition API only, `<script setup lang="ts">`, reactive props destructuring
- **Styling**: Tailwind only (no `<style>` blocks), use `cn()` for conditional classes
- **Types**: No `any`, no `as any`, fix type issues at the source
- **i18n**: All strings via vue-i18n, entries in `src/locales/en/main.json`
- **Tests**: Colocated `*.test.ts` files, behavioral coverage

## Quality Gates

Before committing: `pnpm typecheck && pnpm lint && pnpm format`

## Agent Workspace

- Planning docs: `/temp/plans/`
- Scripts: `/temp/scripts/`
- Summaries: `/temp/summaries/`
- In-progress work: `/temp/in_progress/`
