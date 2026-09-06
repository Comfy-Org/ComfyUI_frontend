# Convergence and idempotency review

Apply this profile to op semantics, validation, transactions, projection, and replay. It protects KA-1, KA-4, KA-10, FC-1, and FC-4.

- Verify the same op set in every legal causal order produces the same byte-stable projection from forks of one seeded snapshot.
- Verify applying an already-seen `op_id` is a byte-identical no-op under `Y.encodeStateAsUpdate`, not merely an unchanged projection.
- Verify every rejection validates before mutation; a failed op must leave encoded document bytes unchanged. **This profile owns the rejection oracle.** `test-quality.md` item 2 names the same oracle for a reviewer's convenience and defers here on any disagreement; if the two ever read differently, this one is authoritative. `docs/INVARIANTS.md` KA-4 remains the authority above both, including its record of which rejection paths are still open. A projection snapshot is not a substitute for a single-document before/after: `project()` reads neither `__stamps` nor `__applied`, so a stray ledger write ahead of a rejection throw *would* read as `bytesEq=false, projEq=true` — plant one and see. The converse also holds and KA-4 relies on it: for the op-only vectors compared **across two replicas** in different arrival orders, the bytes legitimately differ and the projection is the correct oracle.
- Exercise retries, duplicated batches, competing writers, batch boundaries, and both arrival orders. Do not accept one happy-path fixture as convergence proof.
- Reject full-document replacement as a mutation primitive and raw Yjs exchange between independently edited replicas.

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
