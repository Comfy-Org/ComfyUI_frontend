# subgraph/preview

**PR-A scaffolding only — empty until PR-B.**

This directory is reserved for preview exposure types, identity, and chain
resolution helpers landing in PR-B of the subgraph promoted-widget ratchet.

References:

- ADR 0009 — Subgraph promoted-widget migration
- Implementation plan: [`temp/plans/2026-05-05-subgraph-promoted-widget-ratchet.md`](../../../../../temp/plans/2026-05-05-subgraph-promoted-widget-ratchet.md)

Planned modules (PR-B):

- `previewExposureTypes.ts`
- `previewExposureIdentity.ts` — `hostNodeLocator` + `previewName`
- `previewExposureChain.ts` — nested-host chaining

The directory is intentionally empty in PR-A; no production code path imports
from here yet.
