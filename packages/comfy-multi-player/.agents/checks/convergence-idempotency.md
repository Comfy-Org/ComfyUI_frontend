# Convergence and idempotency review

Apply this profile to op semantics, validation, transactions, projection, and replay. It protects KA-1, KA-4, KA-10, FC-1, and FC-4.

- Verify the same op set in every legal causal order produces the same byte-stable projection from forks of one seeded snapshot.
- Verify applying an already-seen `op_id` is a byte-identical no-op under `Y.encodeStateAsUpdate`, not merely an unchanged projection.
- Verify every rejection validates before mutation; a failed op must leave encoded document bytes unchanged.
- Exercise retries, duplicated batches, competing writers, batch boundaries, and both arrival orders. Do not accept one happy-path fixture as convergence proof.
- Reject full-document replacement as a mutation primitive and raw Yjs exchange between independently edited replicas.

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
