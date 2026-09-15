# Op identity and ordering review

Apply this profile to mint, retry, dedupe, stamps, ordering, and LWW conflict handling. It protects KA-2, KA-4, FC-2, FC-7, and FC-9.

- `op_id` is minted by the creator before dispatch and never regenerated on retry.
- The total ordering key is exactly `[base_version, actor, op_id]`; every replica must evaluate it offline.
- Its first two elements are read out of `op.stamp` whenever the op carries the declared two-element wire tuple. The envelope's `base_version`/`actor` is a fallback for a missing or malformed stamp only (`op.stamp.length === 2` in `stampKey`); re-deriving the key from the envelope when a valid stamp IS present is the FC-2 collapse. When a test is offered as evidence for KA-2 or FC-2, check that its ops carry a `stamp` the envelope does not imply — `stamp === [base_version, actor]` cannot distinguish the two readings, and that shape is unremarkable in tests of any other property. The vectors in `test/ka2-stamp-inside-op.test.ts` are the shape that does distinguish them: the in-op stamp and the envelope name different winners.

<!-- claim: op.stamp.length === 2 :: src/stamps.ts -->
<!-- claim: KA-2 / FC-2: the ordering key is read from op.stamp, not the envelope :: test/ka2-stamp-inside-op.test.ts -->
- Resolve conflicts by that stamp, never client-id, arrival order, database read order, or a server sequence alone.
- Verify duplicate `op_id` handling is a true byte-identical no-op. Reuse with different canonical payload/stamp must fail without mutation.
- A server may advance scalar `base_version` for V1, but code and contracts must leave room for a logical clock rather than making the scalar the permanent sole authority.

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
