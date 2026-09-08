# comfy.org (`apps/website`)

This package is the statically generated comfy.org site. It uses Astro pages
with Vue islands; it is not the Vue application in the repository root. The
repository-root `AGENTS.md`, `CONTRIBUTING.md`, and linked file-type guidance
remain authoritative. This file adds only website-specific rules.

## Package boundaries

- Files in `src/pages` define routes. Plain `.astro` pages emit one HTML file;
  dynamic routes emit the paths returned by `getStaticPaths`.
- Astro renders pages at build time. There is no application server handling
  requests after deployment.
- Vue components are client islands only when an Astro page hydrates them with
  a `client:*` directive. Prefer Astro for static content.
- Do not pass `v-model` from Astro to a Vue island. Astro's generated component
  props expose `defineProps`, not `defineModel`; pass an initial prop and emit
  changes instead.
- Keep browser-only APIs out of Astro frontmatter and build-time modules.
- External links opened in a new tab use `rel="noopener noreferrer"`.
- `dist/` is build output and is never committed.
- Website tests live in this package. Root `browser_tests/` and the root
  Vitest configuration test the ComfyUI application, not this site.

## Main must always be deployable

The contents built from `main` are the contents released to comfy.org on the
next production deploy. Do not merge a partial feature unless its public
routes and entry points are intentionally ready, or the build excludes them.

For unfinished work:

- Use one build-time decision for every route and entry point.
- Exclude unreleased routes from the generated output. `noindex`, an unlinked
  page, or a browser-side flag does not make deployed HTML private.
- Test both the release shape and any explicitly enabled preview shape.
- Keep the release shape safe at every independently mergeable PR in a stack.
- When a lower PR changes data or APIs consumed by tests above it, run those
  tests on the affected branches before merging.

Feature-specific switches, expected route sets, and temporary stack state
belong beside the implementation or in the PR description, not in this file.

## Canonical commands

Run package scripts from the repository root so the configuration is
unambiguous:

```sh
pnpm --filter @comfyorg/website test:unit
pnpm --filter @comfyorg/website typecheck
pnpm --filter @comfyorg/website build
pnpm --filter @comfyorg/website test:e2e
pnpm lint
pnpm format:check
```

Focused unit tests may follow `test:unit`. Use the workspace scripts rather
than `npx vitest` or `npx astro`; direct invocations can select the wrong
configuration or binary.

`typecheck` runs both `astro check` and `vue-tsc --noEmit`. A clean Vue
typecheck alone does not cover `.astro` files.

## How the site is generated

`astro build` writes static HTML and assets to `dist/`. Integrations declared
in `astro.config.ts` can add, transform, or validate output. Validators that
read `dist/` are part of the build contract; do not treat correct page counts
as success if the command exits non-zero.

When a change claims existing pages are unaffected, compare a release-shaped
build against the merge base rather than relying on screenshots or page
counts alone:

```sh
apps/website/scripts/compare-build-to-main.sh \
  <baseline-dist> <candidate-dist> [label]
```

Build the baseline from `git merge-base origin/main HEAD`. Investigate every
changed or removed existing page. Added feature routes are acceptable only
when the relevant build shape intentionally enables them.

## Build-time and generated data

The site commits snapshots for data that must not make builds depend on a
private credential or a reliable upstream. Follow these rules for every
snapshot and generator:

- Validate remote and generated data at its boundary with Zod. Do not replace
  validation with a TypeScript assertion.
- Keep accepted values JSON-safe so serialization cannot drop or rewrite
  fields after validation.
- Make generators deterministic and idempotent. Do not use `localeCompare`
  for committed ordering; use an explicit locale-independent comparison.
- Compare canonical output before writing so an unchanged regeneration leaves
  the worktree clean.
- Mark generated artifacts in `.gitattributes` with
  `linguist-generated=true`.
- Add packed generated artifacts to `.oxfmtrc.json` `ignorePatterns` so the
  formatter does not expand or churn them.
- Review generator and schema changes rather than requesting hand-formatting
  of generated output.

Production builds may deliberately require credentials that local builds do
not have. Use the feature's documented release-shape override for local
verification; do not invent public environment variables to bypass a missing
secret.

## Vercel previews and releases

Vercel deployment is driven by repository workflows, not Vercel's automatic
Git integration. Pull requests receive preview deployments; pushes to `main`
produce the production deployment.

Some feature previews are enabled by PR labels. A label may change the
build-time environment for that preview, but must not change the default
production shape. When reviewing such a PR:

- Read the workflow and the feature switch together.
- Verify an unlabeled/release-shaped build first.
- Verify the labeled feature preview separately.
- Never infer production safety merely because the preview looks correct.

Vercel applies redirects from `vercel.json` before static files. Before adding
a page, check both its slash and non-slash paths against redirects. Local
`astro dev` and `astro preview` do not reproduce Vercel redirects.

## Structured data and i18n

- Escape dynamic JSON-LD content with the shared JSON-LD helper before using
  `set:html`.
- Validate external URLs before rendering them into links or HTML.
- Keep `src/i18n/translations.ts` keys present for every supported locale.
  Translation merge conflicts are usually additive: retain both additions and
  check for duplicate keys rather than choosing one side.
- If a route exists only for the invariant locale, add it to
  `LOCALE_INVARIANT_EXTRA_PATHS` in `src/config/routes.ts` so hreflang
  validation does not advertise a missing twin.
