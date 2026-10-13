# ADR-I18N-CATALOGS-0001: Catalog Validation and Delivery Gates

Date: 2026-10-13

## Status

Accepted

## Context

Feature contributors edit English catalogs. App releases generate on version-bump
branches; website generation follows English changes on main. Requiring complete
coverage on every feature would require credentials before those changes could
reach generation. Catalog validity, completeness, and linguistic quality have
different proofs. German is generated without being a shipped app locale.

## Decision

Every pull request and merge queue commit runs the shared offline validator.
Invalid syntax, unsafe markup, broken protected tokens, and unreadable source
provenance fail. Pending translations remain an explicit report, with English
fallback permitted for ordinary features and website deploys.

Generated catalog delivery requires complete eligible coverage for the recorded
English source. Manifest changes and known same-repository generation branches
select this gate. App generation success checks every configured output locale.
App version-bump branches and package version changes require the locales in the
runtime registry; newly shipped app locales require their own completeness. New
website locale definitions, expanded route allowlists, and added localized pages
require completeness for the launched locales. Merge queue comparisons use the
combined base/head changes rather than pull request branch metadata.

The shared translation policy owns legal exclusions and intentional empties.
Generation failures stay visible; completed files can be committed without
claiming full success. A release gate can fail until generation triggers a retry.

Copy review compares changed translations with English, context, and terminology;
human review owns meaning and product wording. It does not replace deterministic
validation. Automated website translation PRs have an owner and pending status.

## Alternatives

- Completeness on every feature would block contributors on credentials and
  prevent post-merge website generation from satisfying the gate.
- A permanent missing-key baseline hides stale coverage and adds separate upkeep.
- All generated locales as a release gate makes unpublished targets dependencies.
- Model approval cannot prove syntax, tokens, freshness, or completeness.

## Consequences

English changes can ship while translations are reviewed. Generated catalogs,
app releases, and locale launches have stricter gates. Publication metadata must
remain statically readable; unsupported shapes fail instead of omitting a locale.
