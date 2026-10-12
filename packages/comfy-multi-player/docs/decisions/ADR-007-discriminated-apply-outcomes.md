# ADR-007: Report one discriminated outcome per submitted op

**Status:** Accepted
**Date:** 2026-08-22
**Issue:** #16

## Context

The pre-0.2 `ApplyResult` used parallel `applied` and `skipped` arrays plus a nullable `failed`. Its `applied` bucket combined writes that changed semantic state, LWW-dropped writes, and delete-wins no-ops. Its `version` field was only the size of the applied-op bookkeeping map, not a CAS or logical version.

## Decision

`ApplyResult` contains an ordered `outcomes` array with exactly one record per submitted op. The record is discriminated as `applied`, `no-op`, `lww-dropped`, or `rejected`; only `rejected` carries a structured reason. Abort-remainder keeps its existing behavior: the failing op is rejected with its existing reason and each unprocessed remainder is rejected with `batch_aborted`.

Rename `version` to `ops_seen`. It remains the applied-op bookkeeping size and explicitly is not a CAS token. Aggregate counts are derived by consumers rather than stored.

## Consequences

- Callers can distinguish semantic writes from conflict and delete-wins outcomes.
- Illegal combinations of parallel arrays and nullable failure state are absent from the public type.
- This is a breaking API change and ships as 0.2.0.
- Op classification and mutation semantics remain unchanged; only reporting changes.
