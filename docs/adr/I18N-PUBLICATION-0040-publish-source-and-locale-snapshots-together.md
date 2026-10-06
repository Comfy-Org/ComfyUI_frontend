# ADR-I18N-PUBLICATION-0040: Publish catalogs and their baselines together

Date: 2026-10-06

## Status

Proposed

## Context

[FE-2045](https://linear.app/comfyorg/issue/FE-2045) calls for shared translation
tooling with host-owned catalogs. The app regenerates changed strings. The
website also contains authored copy, intentional empty fragments, and legal
text that must never enter automatic translation.

To plan a run, the pipeline must tell which English values changed since it
last published and, for the website, which locale values a person edited since
then. Version 1 of `.source-manifest.json` referenced English catalogs as git
blob hashes written with `git hash-object -w`. The repository squash-merges, so
a catalog edited after generation left the recorded blob reachable from no
commit on main. Other clones could not load it, and generation stopped. An
earlier draft also kept digests of generated values in a separate
`.machine-translations.json`. A digest cannot prove human approval, and two
metadata files written separately can disagree after an interrupted run.

## Decision

Record the publication baseline as per-value fingerprints inside
`.source-manifest.json` version 3, committed next to the catalogs. For each
catalog file, `files[<file>]` holds:

- `source`: one entry per tracked English leaf. The key is
  `JSON.stringify(pathSegments)`, such as `["privacy","intro","title"]`. The
  value is the SHA-256 hex digest of `JSON.stringify(value)`. An array is one
  leaf, so changing any element changes its digest.
- `locales[<code>].fingerprints`: the same map for each locale catalog as last
  published. Only the website, whose policy preserves existing copy, records
  locale entries. The app records `source` only.
- `locales[<code>].reviewNeeded` as key-segment arrays, and `knownViolations`
  as `{ locale, path, code, token }` entries, unchanged from version 2.

The digests are comparison metadata. They are not Git object IDs, the pipeline
never looks them up in Git, and planning needs no repository history. A
matching digest shows only that a value equals what generation last wrote; it
is not evidence of human approval.

The pipeline compares the digests of current English with `source` to classify
each key as added, modified or deleted. It compares the digest of each current
locale value with the recorded locale fingerprint to decide whether a person
edited it. It neither stores nor reads the previous English or locale text. A
manifest that fails validation stops both the check and generation; the
pipeline has no degraded mode.

This PR replaces the version-1 manifests with version 3, and the pipeline reads
only version 3. The migration computes fingerprints from the recorded
publication baseline, not from the current catalogs, so edits made after the
last generation still count as changes on the next run.

The website keeps existing copy while English is unchanged and keeps
translations supplied with new keys. When English changes, it regenerates an
eligible translation whose digest still matches its recorded fingerprint and
keeps an edited one. Every retained value whose English changed gets a
`REVIEW NEEDED` flag, because fingerprints record content and cannot show
whether the edit came before or after the English change. A flag persists, even
if the namespace leaves the exclusion list, until a person edits the value or
deletes its `reviewNeeded` entry. Eligible flagged copy is still audited
against current English. Excluded flagged copy defers its token audit and
baseline changes until review, and its flag is a warning rather than a CI
failure. Nonempty excluded copies of the current or previous English are
removed so the page uses fallback; intentional empty strings stay. Deleting
English prunes the matching catalog values, fingerprints and flags.

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

Publish catalogs and the manifest through one recovery journal per target.
Checks reject an unfinished publication. Generation completes that exact
publication before planning against current English, and stops without writing
when a listed file changed since publication began. The journal holds all
recovery data; temporary files hold none. A failure in one catalog file keeps
that file's previous manifest entry and does not discard the other files.

### Alternatives considered

- Git blob references in the manifest are compact, but they depend on objects
  that squash merges and edits after generation leave unreachable.
- Full copies of each published catalog under `.published/`, the previous
  revision of this proposal, carry the same comparison data but duplicate every
  catalog in the repository and in every catalog diff. Planning needs equality,
  not the old text.
- Per-key source, value, and origin digests in a second metadata file need an
  approval convention and can disagree with the manifest after an interrupted
  run. One manifest written in the same publication avoids both.
- Treating a manifest that fails validation as empty would let generation
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

- Any clone of any commit, including a squash-merged one, has the baseline it
  needs to plan the next run.
- Catalogs are stored once. A catalog diff shows the catalog change plus one
  digest line per changed value.
- The app's regeneration policy is unchanged.
- Paired English and locale edits survive generation and surface for review.
- Preflight rejects invalid retained copy before any paid request.
- Stale English duplicates in excluded namespaces cannot freeze an obsolete
  governing text.

### Negative

- The manifest cannot show what the previous English or translation said. A
  reviewer who needs the old wording reads it from version control.
- The manifest grows by one key and one 64-character digest per tracked leaf,
  and on the website per locale as well. This removes duplicate catalog text,
  but increases the current baseline metadata from 1.67 MB to 2.93 MB.
- Contributors must clear review flags by hand, and some flags mark edits that
  were already written against the new English.
- Excluded flagged copy can stay stale until someone reviews it, because its
  warning does not fail CI.
- The journal covers process interruption, not filesystem durability after
  power loss. It must stay out of version control.

## Notes

Contributor instructions live in the Localization section of
`apps/website/README.md` and in `src/locales/CONTRIBUTING.md`.
