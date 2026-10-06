# ADR-I18N-PUBLICATION-0040: Publish source and locale snapshots together

Date: 2026-10-06

## Status

Proposed

## Context

[FE-2045](https://linear.app/comfyorg/issue/FE-2045) calls for shared translation
tooling with host-owned catalogs. The app regenerates changed strings. The
website also contains authored copy, intentional empty fragments, and legal
text that must never enter automatic translation.

To plan a run, the pipeline needs the English it last published and, for the
website, each locale catalog it last published. Version 1 of
`.source-manifest.json` referenced English catalogs as git blob hashes written
with `git hash-object -w`. The repository squash-merges, so a catalog edited
after generation left the recorded blob reachable from no commit on main.
Other clones could not load it, and generation stopped. An earlier draft also
kept digests of generated values in a separate `.machine-translations.json`. A
digest cannot prove human approval, and two metadata files written separately
can disagree after an interrupted run.

## Decision

Keep every piece of provenance as a committed file in the same tree as the
catalogs:

- `.published/en/<file>` holds the last published English for both targets.
- `.published/<locale>/<file>` holds the last published locale catalog for the
  website, whose policy preserves existing copy.
- `.source-manifest.json` version 2 records, per file,
  `locales[<code>].reviewNeeded` as key-segment arrays and `knownViolations` as
  `{ locale, path, code, token }` entries. It no longer references git blobs.

A required snapshot that is missing fails both the check and generation; the
pipeline has no degraded mode. This PR migrates the version-1 manifests, and the
pipeline reads only version 2.

The website keeps existing copy while English is unchanged and keeps
translations supplied with new keys. When English changes, it regenerates an
eligible translation that still matches its snapshot and keeps an edited one.
Every retained value whose English changed gets a `REVIEW NEEDED` flag, because
snapshots record content and cannot show whether the edit came before or after
the English change. A flag persists, even if the namespace leaves the exclusion
list, until a person edits the value or deletes its `reviewNeeded` entry.
Eligible flagged copy is still audited against current English. Excluded
flagged copy defers its token audit and baseline changes until review, and its
flag is a warning rather than a CI failure. Nonempty excluded copies of the
current or previous English are removed so the page uses fallback; intentional
empty strings stay. Deleting English prunes the matching catalogs, snapshots
and flags. A matching snapshot is not approval.

The host package owns locale, glossary, and exclusion policy. Its local scripts
call the shared CLI; the repository root uses `pnpm --filter`. The website
excludes `tos`, `enterprise-msa`, `privacy`, `desktop_privacy`,
`affiliate-terms` and `minimaxLicense`. The `minimaxLicense` exclusion is
deliberately conservative and covers the whole localized MiniMax license page.
Translation exclusion is separate from route availability: the Chinese privacy
route stays translated, and Japanese catalogs receive eligible namespaces whose
pages have no Japanese route. Generation never publishes routes.

Website validation is strict. Plural messages keep the English form count or
collapse to one form, and each form's placeholders and markup are protected.
Generated values must keep link URLs unchanged. Authored values may add the
target-locale prefix to an internal link; the validator does not certify that
the localized route exists. The app keeps its set-based validation and its
regeneration policy.

Publish catalogs, snapshots and the manifest through one recovery journal per
target. Checks reject an unfinished publication. Generation completes that
exact publication before planning against current English, and stops without
writing when a listed file changed since publication began. The journal holds
all recovery data; temporary files hold none.

### Alternatives considered

- Git blob references in the manifest are compact, but they depend on objects
  that squash merges and edits after generation leave unreachable.
- Per-key source, value, and origin digests duplicate source identity and need
  a second approval convention. File snapshots already contain the data.
- Warning instead of failing on a missing snapshot would let generation
  misclassify every locale value without anyone noticing.
- Keeping an edited translation without a flag when its English changed would
  treat an edit that may predate the English change as reviewed.
- Retranslating excluded legal text would remove stale content but bypass legal
  review.
- Writing locale files before the manifest converges only while English stays
  unchanged. After a crash and another English edit, old generated output looks
  like a simultaneous human update. The journal preserves that distinction.

## Consequences

### Positive

- Any clone of any commit, including a squash-merged one, has the provenance it
  needs to plan the next run.
- The app's regeneration policy is unchanged.
- Paired English and locale edits survive generation and surface for review.
- Preflight rejects invalid retained copy before any paid request.
- Stale English duplicates in excluded namespaces cannot freeze an obsolete
  governing text.

### Negative

- Every published catalog appears twice in the repository, and catalog diffs
  include snapshot changes.
- Contributors must clear review flags by hand, and some flags mark edits that
  were already written against the new English.
- Excluded flagged copy can stay stale until someone reviews it, because its
  warning does not fail CI.
- The journal covers process interruption, not filesystem durability after
  power loss. It must stay out of version control.

## Notes

Contributor instructions live in the Localization section of
`apps/website/README.md` and in `src/locales/CONTRIBUTING.md`.
