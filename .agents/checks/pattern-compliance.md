---
name: pattern-compliance
description: Checks code against repository conventions in AGENTS.md and docs/guidance that lint does not enforce
severity-default: medium
tools: [Read, Grep]
---

Check changed code against the repository's conventions.

1. Read the root `AGENTS.md`, every `AGENTS.md` above each changed file, and the `docs/guidance/*.md` files whose globs match it.
2. Flag violations in changed code. Lint already rejects `any`, `@ts-ignore`, mixed type imports, `dark:` classes, raw template text, `v-html`, `console.log`, `throw new Error` in `src/`, and PrimeVue imports; do not repeat those.

Pay particular attention to these rules, which no lint rule enforces:

### TypeScript

- Every new `eslint-disable` or `oxlint-disable` directive is a finding. A comment describing an inconvenience does not justify it. Accept a narrow exception only when the PR description names the external constraint, after the diagnostic was checked and no typed pattern exists.
- Double assertions, and assertions that replace runtime narrowing at an external boundary.
- `lodash` imports instead of `es-toolkit`.
- `z.any()` in Zod schemas instead of `z.unknown()` plus narrowing.
- A server or API response type written by hand instead of imported from `@comfyorg/ingest-types` or `@comfyorg/registry-types`. `comfy/no-duplicate-ingest-type` only catches files that also import the generated type (see `docs/guidance/typescript.md`).

### Vue

- `withDefaults` or runtime props instead of reactive props destructuring.
- User-facing strings in script code not passed through `vue-i18n` `t()`; new keys belong in `src/locales/en/main.json`.

### Tailwind

- Class arrays (`:class="[]"`) instead of `cn()` from `@comfyorg/tailwind-utils`.
- `!important` or the `!` prefix.
- `<style>` blocks in SFCs.
- Arbitrary values where a semantic token or fraction utility exists.

### General

- Hardcoded URLs, credentials, or environment-specific values.

Rules:

- Only flag actual violations in changed code.
- When this list and `AGENTS.md` disagree, `AGENTS.md` wins.
