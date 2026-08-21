# Agent guide

`@comfyorg/comfy-multi-player` is the single shared, pure semantic-op-to-Yjs-document applier for ComfyUI's in-app agent and CRDT workflow state. The browser imports this package, and the server doc host runs the same package in Node. There is no second applier implementation.

## Load-bearing rules

**Every change must preserve [docs/INVARIANTS.md](docs/INVARIANTS.md). Read it before editing.**

The op layer must run identically in a browser and the Node doc-host sidecar. Keep it free of DOM, UI-framework, LiteGraph, and server-only dependencies. `yjs` is the only permitted runtime dependency. Do not infer correctness from a browser-only or Node-only run.

Any change touching op semantics, public exports, the dependency set, or the widget catalog must cite the affected `KA-*` and `FC-*` invariant IDs in its PR description. Deliberate deviations require an entry in `docs/decisions/EXCEPTIONS.md`.

## Develop and verify

```sh
npm ci
npm run build
npm run check:purity
npm run check:imports
npm run check:pins
npm run check:profile-claims
npm run verify:corpus
npm test
```

Run all eight commands before review — that is the set CI runs, and the list was
short by three (`check:pins`, `check:profile-claims`, `verify:corpus`) from the
day each of those gates landed. The purity gate asserts positively that the declared and resolved production dependency roots are exactly `{yjs}`, and adds a dependency denylist and a bare-Node import probe (issue #22, which raised the missing positive assertion, is closed). `check:imports` covers the same contract one layer down — it cruises the module graph with `.dependency-cruiser.cjs` and asserts the yjs-only and no-Node-builtin boundaries **per source module**, which is what the package-level gate structurally cannot see; it exits `2` (INCONCLUSIVE) rather than green if it analyzed too few modules to mean anything.

Mutation testing (`npm run test:mutation`, nightly in `mutation.yml`) is only comparable across runs because `stryker.config.mjs` pins `timeoutMS`, `timeoutFactor`, `concurrency` and `coverageAnalysis`. Stryker scores a `Timeout` as killed, so with those unpinned the score rises with host load. Do not unpin them, and do not quote a score without running `npm run check:mutation-report` — it re-derives the number, reports `Timeout` separately, and exits 2 INCONCLUSIVE when timeouts are material.

Reviewer-agent concern profiles live in `.agents/checks/`. Apply every relevant profile to semantic, export, dependency, catalog, and replication-boundary changes.

## Review comments

- Use one or two concise prose paragraphs, with the concrete concern first.
- Prefer collaborative questions and non-blocking `suggestion:` / `nitpick:` / `question:` labels; reserve `issue:` / `todo:` for correctness or security.
- Backtick file paths and symbols and tie the concern to named `KA-*` / `FC-*` IDs.
- Avoid praise, filler, headings, status banners, tables, emoji, and em dashes.
- Anchor comments inline where possible. Draft comments for human approval before posting.
