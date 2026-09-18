# ADR-I18N-WEBSITE-0035: Website Locales Share the App Translation Pipeline

Date: 2026-09-18

## Status

Proposed

## Context

The application translates `src/locales/en/*.json` into thirteen locales with
`scripts/i18n/update-locales.ts`: a source manifest records which English
blob each translation came from, changed strings are re-queued, placeholders
and protected literals are validated, and `pnpm locale:check` runs offline in
CI. The website under `apps/website` grew its own catalog instead: one
10,800-line TypeScript map of `key -> { en, 'zh-CN', ja }`, hand-filled, with
Japanese at 107 of 2,856 keys because nothing generated it.

Two attempts to give the website a pipeline (#16747, #17207) copied the app's
translator into `apps/website/scripts/i18n/`, adapted to the map's shape. Both
stalled in review, and the second monorepo-wide localization stack was closed.
FE-2045 asks for one set of tooling rather than a bespoke engine per surface.

Forces that shape the answer:

- The website renders statically per locale, so its runtime API is
  `t(key, locale)` with an explicit locale; 660 files call it. vue-i18n's
  global instance assumes one active locale per process, so adopting it means
  passing the locale per call rather than switching the instance.
- The app pipeline keys everything off the catalog file layout
  (`<output>/<locale>/<entry>.json`) and a manifest beside it, not off the
  application.
- Eleven website keys were both a leaf and a prefix of other keys
  (`learning.categories.all` and `learning.categories.all.blurb`), which a
  nested catalog cannot express.
- Consumers filled placeholders with `String.replace('{name}', …)` on the
  raw message, and 21 messages carried a literal `@` or `|`, both of which
  vue-i18n's compiler treats as syntax.
- Approved Chinese copy must not be rewritten by the first pipeline run.

## Decision

Move the website catalogs into the app's per-locale JSON layout, adopt
vue-i18n's message syntax and runtime for them, and translate them with the
existing script, parameterised by target.

- `apps/website/src/locales/<locale>/main.json` holds each locale as the same
  nested object tree the app uses. The eleven leaf/prefix collisions gain a
  `label`, `text` or `message` segment, and their consumers follow.
- Messages follow vue-i18n syntax: named placeholders, `|`-separated plural
  forms, and `{'@'}` / `{'|'}` for literal special characters. The website's
  `translations.ts` wraps a vue-i18n instance and resolves every call with an
  explicit `locale` option, so no global locale is ever switched. Consumers
  pass named values (`t(key, locale, { name })`) instead of replacing
  placeholders in the returned string, and label objects handed to child
  components carry functions rather than messages with placeholders.
- `scripts/i18n/config.ts` gains a `website` entry in `translationTargets`
  with the website's entry and output directories, output locales (`zh-CN`,
  `ja`) and glossary; `update-locales.ts` selects it with `--target website`.
  Everything else (manifest, diffing, validation, chunking, retries) is
  unchanged and shared.
- `apps/website/src/i18n/translations.ts` keeps its API and import path and
  now reads the JSON catalogs, so consumers are untouched. Locale codes live
  in `apps/website/src/locales/localeConfig.ts`, mirroring the app.
- `pnpm locale:website:check` joins the shared lint/format CI step; an
  `i18n: Update Website` workflow runs the translation on demand, mirroring
  the core workflow's checkout-and-commit pattern.
- The one string whose Chinese translation split an English sentence across
  two keys (`models.list.heroTitle.before`/`.after`, with an empty English
  half) becomes a single message with a `{brand}` placeholder that the
  component splits on. It was the only existing translation the pipeline's
  placeholder audit rejected.

Alternatives considered:

- **A website-local copy of the translator** (#16747, #17207): rejected; it is
  the second engine FE-2045 exists to avoid.
- **Flat `key -> string` catalogs**: rejected; vue-i18n and its lint plugin
  resolve nested paths, and a second file shape means a second set of rules.
- **Keeping the hand-written resolver**: rejected; it accepted messages the
  vue-i18n compiler rejects, so the two surfaces would keep drifting.
- **Switching the vue-i18n global locale per page**: rejected; Astro renders
  pages concurrently at build time, and an explicit locale per call is the
  only model that is correct there.
- **`<i18n-t>` component interpolation for markup inside a message**:
  deferred; it needs the plugin installed on every island's Vue app. The two
  headings that wrap a placeholder in markup use `tAround`, which resolves
  the message and splits it around that slot.
- **A shared `@comfyorg/i18n-tools` package**: deferred. The script is not
  consumed outside this repository, and a `--target` flag reaches the same
  outcome without a publish step.

## Consequences

### Positive

- One translator, one manifest format, one validation rule set for both
  surfaces; fixes to the pipeline reach the website for free.
- Japanese can be filled by running one workflow instead of by hand.
- `locale:check` catches placeholder drift in website translations in CI, and
  a unit test compiles every message with vue-i18n so syntax errors fail
  before a page renders.
- Consumers interpolate through the compiler, so a missing or renamed
  placeholder is a visible empty value rather than a leaked `{name}`.

### Negative

- Section comments in the old TypeScript map are lost; keys are prefixed by
  page, which carries the same grouping.
- The pipeline sorts non-English catalogs alphabetically, so those files no
  longer follow page order.
- The website's `zh-CN` code differs from the app's `zh`; the URL prefix is
  public, so the website keeps its code and the target config maps it.
- Every island that imports `translations.ts` now bundles the vue-i18n
  runtime and compiler alongside the catalogs.

### Follow-ups

- Run the website workflow once to fill Japanese, then review the output with
  a native speaker as the app's locales are.
- Content collections (MDX, `src/data/*.ts`) still hold locale copy outside
  the catalogs; they are out of scope here and remain hand-translated.
