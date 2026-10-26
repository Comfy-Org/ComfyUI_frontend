# ADR-ARCHITECTURE-BOUNDARIES-0049: Shared public contracts without consumer allowlists

Date: 2026-10-26

## Status

Proposed

## Context

The domain catalog requires reciprocal approval for cross-domain imports.
That suits feature dependencies, but ordinary UI controls, error reporting,
and shared data contracts are designed for callers throughout the application.
Requiring approval for each caller reports routine reuse as an architecture
violation and makes substantive dependency warnings harder to distinguish.

Some shared domains also contain implementation details or feature-specific
helpers. Broad access to a domain's inventory would expose those files along
with the reusable contracts.

Separate records for pure color, formatting, math, and type-guard utilities
repeat the same boundary policy. Empty metadata lists and per-file public API
lists add maintenance without expressing a different ownership decision.

## Decision

Allow a producer to declare its public entry points consumable by all
domains. Keep role restrictions, internal-file permissions, and outgoing
dependency approvals unchanged. Public UI components remain unavailable to
domain and application logic. Feature-owned components retain their ownership
even when their directories are nested under shared component directories.

Combine pure color, formatting, math, and type-guard utilities in
`shared-foundation`. Keep separate domains for distinct ownership or dependency
constraints. Omitted `allowedDependencies`, `allowedConsumers`, and `adrs`
default to empty lists. Make `characterizationScenarios` and
`compatibilityPromises` optional so records carry meaningful commitments
rather than empty boilerplate.

Allow `publicEntryPoints` to name files or directories ending in `/**`.
Expand a declared directory to its owned source files, excluding tests,
stories, mocks, fixtures, and files in private or internal directories. Apply explicit
`publicExcludes` for other implementation details. Resolve feature ownership
overrides and retain each file's role before granting public access.

Protect meaningful caller behavior and compatibility contracts with tests.
Cataloging an existing API does not require a characterization test per entry,
including trivial icons. Boundary tests still protect role direction, private
files, and feature ownership while allowing intended shared reuse.

## Alternatives and consequences

- Reciprocal lists for every shared-library caller duplicate the producer's
  intent and need maintenance whenever a feature adopts an existing control.
- Opening all inventory internals would turn classification into permission
  and expose helpers that have no supported external contract.
- Merging feature domains to silence warnings would obscure their distinct
  responsibilities. Shared public access does not require merging ownership.
- File-only public entries require record changes for every new API. Declared
  public directories avoid that duplication, but new owned source files become
  public unless an exclusion applies. Authors must exclude private helpers or
  place them in private or internal directories.
- A characterization test per catalog entry would reward test counts rather
  than behavioral coverage. Existing tests can protect shared contracts
  without mirroring the catalog.
- Test fixtures and cross-feature orchestration still need separate dependency
  decisions. This policy does not exempt them from boundary checks.
