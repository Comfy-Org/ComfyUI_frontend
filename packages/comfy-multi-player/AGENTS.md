# Agent guide

`@comfyorg/comfy-multi-player` is the single shared, pure semantic-op-to-Yjs-document applier for ComfyUI's in-app agent and CRDT workflow state. The browser imports this package, and the server doc host runs the same package in Node. There is no second applier implementation.

## Load-bearing rules

**Every change must preserve [docs/INVARIANTS.md](docs/INVARIANTS.md). Read it before editing.**

The op layer must run identically in a browser and the Node doc-host sidecar. Keep it free of DOM, UI-framework, LiteGraph, and server-only dependencies. `yjs` is the only permitted runtime dependency. Do not infer correctness from a browser-only or Node-only run.

Any change touching op semantics, public exports, the dependency set, or the widget catalog must cite the affected `KA-*` and `FC-*` invariant IDs in its PR description. Deliberate deviations require an entry in `docs/decisions/EXCEPTIONS.md`.

## Develop and verify

```sh
pnpm install
pnpm run build
pnpm run check:purity
pnpm run check:imports
pnpm run check:pins
pnpm run check:profile-claims
pnpm run check:coderabbit
pnpm run verify:corpus
pnpm test
```

Run all nine commands before review — that is the set CI runs, and the list was
short by three (`check:pins`, `check:profile-claims`, `verify:corpus`) from the
day each of those gates landed. `check:coderabbit` regenerates `.coderabbit.yaml`'s sentinel-delimited region from the
`<!-- coderabbit-instructions -->` blocks in `.agents/checks/*.md` and fails on any byte
difference — including inside the generated header comments, which are emitted too. If it
fails, edit the block in the owning profile and run `pnpm run gen:coderabbit`, never the YAML
directly. Like `check:imports` it has a third outcome: it exits `2` (INCONCLUSIVE) when it
cannot run over meaningful work — no profiles directory, no config file, no sentinels, or
fewer source blocks than its floor — and `2` is never a pass. The purity gate asserts positively that the declared and resolved production dependency roots are exactly `{yjs}`, and adds a dependency denylist and a bare-Node import probe (issue #22, which raised the missing positive assertion, is closed). `check:imports` covers the same contract one layer down — it cruises the module graph with `.dependency-cruiser.cjs` and asserts the yjs-only and no-Node-builtin boundaries **per source module**, which is what the package-level gate structurally cannot see; it exits `2` (INCONCLUSIVE) rather than green if it analyzed too few modules to mean anything.

Mutation testing (`pnpm run test:mutation`, nightly in `mutation-comfy-multi-player.yaml`) is only comparable across runs because `stryker.config.mjs` pins `timeoutMS`, `timeoutFactor`, `concurrency` and `coverageAnalysis`. Stryker scores a `Timeout` as killed, so with those unpinned the score rises with host load. Do not unpin them, and do not quote a score without running `pnpm run check:mutation-report` — it re-derives the number, reports `Timeout` separately, and exits 2 INCONCLUSIVE when timeouts are material.

CI deliberately omits a raw line or branch coverage floor. The mutation threshold plus the survivor and no-coverage inventory is the primary coverage-quality gate; adding a line/branch floor would measure execution breadth without proving assertions catch behavioral changes. This is a gate choice, not an invariant exception, so it belongs here and in `docs/mutation-testing.md`, not in `docs/decisions/EXCEPTIONS.md`.

Reviewer-agent concern profiles live in `.agents/checks/`. Apply every relevant profile to semantic, export, dependency, catalog, and replication-boundary changes.

## Permutation and property testing

Use permutation-exhaustive tests when a concurrency surface has a small, explicitly bounded domain: enumerate every legal arrival order and every selected equivalence-class value, assert the exact case count, and include the full case dimensions in assertion messages so a failure is directly reproducible. Prefer this for two-writer register contention, normalized-ID collisions, batch-boundary choices, and short causal interleavings.

Use deterministic `fast-check` properties when the Cartesian product is unbounded or exceeds the review budget. Every property suite must pin both `seed` and `numRuns`; preserve fast-check's shrunk counterexample output, and add vacuity guards proving that the generated run exercised the contested behavior. A fixed seed makes CI replayable, not exhaustive, so describe the bounded domain or sampled coverage honestly.

Keep a new suite below 20,000 evaluated cases and eight minutes in the normal full test run. Do the product math before implementation and record the dimensions in the test or PR. If exhaustive coverage exceeds either cap, reduce the domain by named equivalence classes or switch to fixed-seed property sampling. Never imply that a bounded domain proves every possible workflow or op stream.

## Review comments

- Use one or two concise prose paragraphs, with the concrete concern first.
- Prefer collaborative questions and non-blocking `suggestion:` / `nitpick:` / `question:` labels; reserve `issue:` / `todo:` for correctness or security.
- Backtick file paths and symbols and tie the concern to named `KA-*` / `FC-*` IDs.
- Avoid praise, filler, headings, status banners, tables, emoji, and em dashes.
- Anchor comments inline where possible. Draft comments for human approval before posting.
