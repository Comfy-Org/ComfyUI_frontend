---
name: pattern-compliance
description: Checks code against repository conventions from AGENTS.md and established patterns
severity-default: medium
tools: [Read, Grep]
---

Check code against repository conventions and framework patterns.

Steps:

1. Read AGENTS.md (and any directory-specific guidance files) for project-specific conventions
2. Read each changed file
3. Check against the conventions found in AGENTS.md and these standard patterns:

### TypeScript

- No `any` types or `as any` assertions
- No new `@ts-ignore` or `@ts-nocheck`. Allow `@ts-expect-error` only in a test
  that intentionally verifies a compiler error.
- Treat all new `eslint-disable` and `oxlint-disable` directives as findings. Do
  not accept a directive because its comment describes an inconvenience. Verify
  the diagnostic, trace the value to its authoritative type or schema, search
  for an existing typed pattern, and identify the external constraint before
  accepting a narrow exception.
- Flag double assertions and assertions that replace runtime narrowing at an
  external boundary
- Separate type imports (`import type { ... }`)
- Use `import type { ... }` for type-only imports
- Explicit return types on exported functions
- Use `es-toolkit` for utility functions, NOT lodash. Flag any new `import ... from 'lodash'` or `import ... from 'lodash/*'`
- Never use `z.any()` in Zod schemas — use `z.unknown()` and narrow
- Never hand-declare or duplicate server/API response types locally — flag any local interface/type that reimplements a type already generated from an OpenAPI spec (e.g. `@comfyorg/ingest-types`, `@comfyorg/registry-types` in `packages/`) instead of importing it. This caused real bugs in PR #14771 (see `docs/guidance/typescript.md`)

### Vue (if applicable)

- Composition API with `<script setup lang="ts">`
- Reactive props destructuring (not `withDefaults` pattern)
- New components must use `<script setup lang="ts">` with reactive props destructuring (Vue 3.5 style): `const { color = 'blue' } = defineProps<Props>()`
- Separate type imports from value imports
- All user-facing strings must use `vue-i18n` (`$t()` in templates, `t()` in script). Flag hardcoded English strings in templates that should be translated. The locale file is `src/locales/en/main.json`

### Tailwind (if applicable)

- No `dark:` variants (use semantic theme tokens)
- Use `cn()` utility for conditional classes
- No `!important` in utility classes
- Tailwind 4: CSS variable references use parentheses syntax: `h-(--my-var)` NOT `h-[--my-var]`
- Use design tokens: `bg-secondary-background`, `text-muted-foreground`, `border-border-default`
- No `<style>` blocks in Vue SFCs — use inline Tailwind only

### Testing

- Behavioral tests, not change detectors
- No mock-heavy tests that don't test real behavior
- Test names describe behavior, not implementation
- No Testing Library rule disables used to permit DOM traversal. Prefer a
  semantic query, or fix missing component semantics.
- No timing sleeps. Wait on observable readiness or control time explicitly.
- No malformed fixtures cast to the expected domain type. Pass `unknown` data
  through the production parser.

### General

- No commented-out code
- No `console.log` in production code (unless intentional logging)
- No hardcoded URLs, credentials, or environment-specific values
- Package manager is `pnpm`. Never use `npm`, `npx`, or `yarn`. Use `pnpm dlx` for one-off package execution
- Sanitize HTML with `DOMPurify.sanitize()`, never raw `innerHTML` or `v-html` without it

Rules:

- Only flag ACTUAL violations, not hypothetical ones
- AGENTS.md conventions take priority over default patterns if they conflict
