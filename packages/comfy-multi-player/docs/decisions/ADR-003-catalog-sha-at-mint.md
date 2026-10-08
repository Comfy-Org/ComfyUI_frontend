# ADR-003: Catalog pinned by sha256 at mint

**Status:** Accepted
**Date:** 2026-08-20
**Invariants:** KA-12, FC-10

## Context

The widget catalog is a derived `object_info` projection used to map positional widget values to stable names. Catalog contents can change as node definitions evolve. Replaying an operation against a moving branch could therefore change its meaning silently.

Unknown classes and catalog mismatches are distinct: an unknown frontend-only class may carry opaque values, while a claimed catalog entry with incompatible shape must not be guessed or padded.

## Decision

- Mint records the exact catalog identity in `meta.catalog_version`.
- Catalog identity is a sha256 content pin, never a branch or other moving reference.
- Widget writes to uncatalogued classes fail closed and loudly.
- Replay uses the catalog cited at mint; it does not re-derive historical payloads from current defaults.

## Consequences

- Identical ops retain identical interpretation over time.
- Deployments must distribute and validate the pinned catalog before accepting writes.
- Catalog provenance and fixture generation need immutable source references and CI drift checks.

## Alternatives considered

- **Track a branch:** rejected as FC-10 because branch movement silently changes the contract.
- **Use latest catalog on replay:** rejected because defaults and widget ordering drift.
- **Guess unknown widget layout:** rejected because silent mis-keying is worse than a loud failure.
