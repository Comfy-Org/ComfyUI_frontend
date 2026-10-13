# ADR-I18N-CATALOGS-0001: Catalog Validation and Delivery Gates

Date: 2026-10-13

## Status

Accepted

## Context

Contributors edit English; releases generate on version-bump branches and website
generation follows changes on main. Completeness on every feature would require
credentials before changes could reach generation. German is generated but not
shipped. Catalog validity, completeness, and copy quality need different proofs.

## Decision

Every PR and merge queue commit runs the shared offline validator. Invalid syntax,
unsafe markup, broken protected tokens, and unreadable provenance fail. Ordinary
features and website deploys can use English fallback with pending work reported.

Manifest changes and same-repository generation branches require complete
eligible coverage for recorded English. Generation checks all configured outputs;
app version-bump branches and version changes check the runtime registry. New
app/website locales, expanded route allowlists, and added localized pages check
the launched locales. Merge queues use combined base/head changes, since they
lack PR branch metadata. Branch-creation pushes have no comparison range and
retain ordinary integrity checks.

Shared policy owns legal exclusions and intentional empties. Failures stay
visible; completed files can be committed without claiming full success. A
release gate can fail until generation triggers fresh checks.

Copy review compares translations with English, context, and terminology; human
review owns meaning. It does not replace deterministic validation. Automatic
website translation PRs have an owner and pending status.

## Alternatives

- Every-feature completeness blocks post-merge generation on credentials.
- Missing-key baselines hide stale coverage and add separate upkeep.
- Releasing all generated locales makes unpublished targets dependencies.
- Model approval cannot prove syntax, tokens, freshness, or completeness.

## Consequences

English can ship while translations are reviewed; delivery has stricter gates.
Metadata must be statically readable; unsupported shapes fail instead of omitting
a locale.
