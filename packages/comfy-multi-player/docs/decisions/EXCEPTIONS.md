# Invariant exceptions

Deliberate deviations from `docs/INVARIANTS.md` require explicit maintainer review before implementation. Add one row per approved deviation; do not use this log to retroactively excuse a violation. Rows marked **PROPOSED** were written by a reviewer and are NOT yet agreed: their owner and sunset date are the maintainer's to assign, and until they are, the row records the deviation without claiming it was signed off.

| Date | Invariant ID | Why | Scope | Expiry |
| --- | --- | --- | --- | --- |
| YYYY-MM-DD | KA-0 / FC-0 | Decision and approver | Exact files, release, or deployment | Date or removal condition |
| 2026-08-21 (PROPOSED) | KA-4 | Four `connect` rejections mutate before validating (issue #10). Measured, not assumed, and asserted as *still broken* so the exception cannot outlive the bug. | `src/applier.ts` connect + inputcount-grow paths; recorded in `test/ka4-rejection-byte-identity.test.ts` | Owner: UNASSIGNED. Sunset PROPOSED, not agreed: PR #34 lands. That block then goes red and the rows move into `CASES`. |
| 2026-08-21 (PROPOSED) | KA-3 | This applier REJECTS an interior write into a shared subgraph definition where comfy-cli FORKS it, and it counts instances by resolved definition where comfy-cli's `engine._count_instances` matches the literal id string. Pre-declared by schema §5.3, which keeps forking OPEN; recorded here so the divergence has an owner and a sunset rather than living only in source comments. | `src/doc.ts` `countDefinitionInstances`/`definitionAliases`; `src/applier.ts` §5.3 guard | Owner: UNASSIGNED. Sunset PROPOSED, not agreed: the schema §5.3 forking amendment lands and both implementations adopt it. |
