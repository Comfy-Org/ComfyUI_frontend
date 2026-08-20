# Review-harness roadmap

## Current state

V1 is an op-based Yjs document applier implemented once in the shared `@comfyorg/comfy-multi-player` TypeScript package. The browser and Node doc-host sidecar consume the same git-SHA-pinned package. Semantic ops are the replication unit; the widget catalog is sha256-pinned and fail-closed in the deployed architecture.

## Guard gaps

- **Positive purity assertion (#22):** replace reliance on a dependency denylist with a direct assertion that `yjs` is the only runtime dependency. Add a cross-language parity guard only if a second-language implementation is proposed; the preferred policy is no second implementation.
- **Property tests (#24):** cover arbitrary op sequences, legal causal permutations, retries, batch boundaries, actor counts, byte-identical idempotency, and schema-version failure on the normal read path.
- **Catalog-SHA lint (#22):** fail on moving branch/tag citations in vocabulary and catalog references.
- **Conformance-corpus provenance (#23):** record generator repository and commit SHA, command, environment, and manifest; regenerate and diff in CI.
- **Cross-language parity guard (#22):** if the single-package decision is deliberately revisited, both implementations must pass shared golden vectors before merge.
- **Reject-without-mutation (#10):** preserve the byte-identical rejection contract while fixing validation ordering in a later behavior ticket.

These are follow-up behavior/CI tickets. This harness does not implement them or change the current CI baseline.

## Repository plan

Keep this as a separate repository while the V1 contract stabilizes and parallel tickets #10–#25 land. Migrate the package into the frontend monorepo later if ownership and release operations benefit. Consumers use the identical `@comfyorg/comfy-multi-player` import path either way, so repository placement must not create a second implementation or alter op semantics.
