# subgraph/migration

**PR-A scaffolding only — empty until PR-B.**

This directory is reserved for the proxyWidget migration planner and helpers
landing in PR-B of the subgraph promoted-widget ratchet.

References:

- ADR 0009 — Subgraph promoted-widget migration
- Implementation plan: [`temp/plans/2026-05-05-subgraph-promoted-widget-ratchet.md`](../../../../../temp/plans/2026-05-05-subgraph-promoted-widget-ratchet.md)

Planned modules (PR-B):

- `proxyWidgetMigrationPlanner.ts` — classify + plan
- `proxyWidgetMigrationFlush.ts` — defer/flush, idempotent
- `classifyProxyEntry.ts`
- `repairValueWidget.ts`
- `repairPrimitiveFanout.ts`
- `migratePreviewExposure.ts`
- `quarantineEntry.ts`

The directory is intentionally empty in PR-A; no production code path imports
from here yet.
