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

## Decision

Allow a producer to declare its explicit public entry points consumable by all
domains. Keep role restrictions, internal-file permissions, and outgoing
dependency approvals unchanged. Public UI components remain unavailable to
domain and application logic. Feature-owned components retain their ownership
even when their directories are nested under shared component directories.

Publish caller-facing components, composition pieces, types, and shared
foundation APIs with characterization coverage. Do not infer public access
from directory membership, existing import frequency, or a file being a test.

## Alternatives and consequences

- Reciprocal lists for every shared-library caller duplicate the producer's
  intent and need maintenance whenever a feature adopts an existing control.
- Opening all inventory internals would turn classification into permission
  and expose helpers that have no supported external contract.
- Merging feature domains to silence warnings would obscure their distinct
  responsibilities. Shared public access does not require merging ownership.
- Explicit public entries require a deliberate update when a new reusable API
  is introduced. This keeps tests, stories, and implementation files private.
- Test fixtures and cross-feature orchestration still need separate dependency
  decisions. This policy does not exempt them from boundary checks.
