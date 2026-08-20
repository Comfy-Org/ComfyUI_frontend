# Reviewer-agent check profiles

Concern profiles a reviewer agent (or a human) applies to a change. Apply every profile relevant to the change; cite the affected `KA-*` / `FC-*` IDs from [`../../docs/INVARIANTS.md`](../../docs/INVARIANTS.md).

## CRDT / op-layer profiles (this repo's core)

| Profile | Protects | Apply to |
| --- | --- | --- |
| [`purity.md`](purity.md) | KA-3, FC-3 | exports, deps, build, applier/projection/mint |
| [`convergence-idempotency.md`](convergence-idempotency.md) | KA-4 | applier, ordering, dedupe |
| [`op-identity.md`](op-identity.md) | KA-2, KA-4, FC-2, FC-7, FC-9 | mint, retry, stamps, LWW |
| [`follower-boundary.md`](follower-boundary.md) | KA-6, FC-5 | replication / write boundary |
| [`catalog-pinning.md`](catalog-pinning.md) | KA-12, FC-10 | widget catalog, mint |

## General engineering profiles (ported from ComfyUI_frontend `.agents/checks/`, adapted to this pure library)

| Profile | Focus |
| --- | --- |
| [`architecture-reviewer.md`](architecture-reviewer.md) | structure, over/under-engineering, single-implementation rule |
| [`complexity.md`](complexity.md) | cyclomatic complexity, nesting, duplication |
| [`error-handling.md`](error-handling.md) | fail-closed, no swallow, mutate-before-throw (issue #10), abort-remainder |
| [`regression-risk.md`](regression-risk.md) | git-blame bugfix-line detection |
| [`test-quality.md`](test-quality.md) | assertion strength, convergence/idempotency coverage, Vitest/`test/` conventions |
| [`import-graph.md`](import-graph.md) | circular deps, layer/purity boundaries (dependency-cruiser) |
| [`api-contract.md`](api-contract.md) | exports, op vocabulary, wire envelope, schema/catalog versioning |
| [`dep-secrets-scan.md`](dep-secrets-scan.md) | npm audit + gitleaks; yjs-only dep set |
| [`semgrep-sast.md`](semgrep-sast.md) | dangerous patterns, weak randomness on the mint path |
| [`sonarjs-lint.md`](sonarjs-lint.md) | SonarJS bug/smell rules (config: [`eslint.strict.config.js`](eslint.strict.config.js)) |

The general profiles were adapted from the frontend versions: FE-only context (Vue/Pinia, `window` globals, LiteGraph, `pnpm`, colocated tests, `useErrorHandling`) was replaced with this repo's reality — a pure `yjs`-only op-layer, `npm`, Vitest under `test/`, `OpRejectedError`/fail-closed semantics, and the `src/index.ts` + wire-envelope contract.
