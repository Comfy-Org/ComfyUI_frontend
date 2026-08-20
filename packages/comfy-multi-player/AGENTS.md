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
npm test
```

Run all four commands before review. The purity gate currently includes a dependency denylist and bare-Node import probe; its missing positive `yjs`-only assertion is tracked in issue #22.

Reviewer-agent concern profiles live in `.agents/checks/`. Apply every relevant profile to semantic, export, dependency, catalog, and replication-boundary changes.

## Review comments

- Use one or two concise prose paragraphs, with the concrete concern first.
- Prefer collaborative questions and non-blocking `suggestion:` / `nitpick:` / `question:` labels; reserve `issue:` / `todo:` for correctness or security.
- Backtick file paths and symbols and tie the concern to named `KA-*` / `FC-*` IDs.
- Avoid praise, filler, headings, status banners, tables, emoji, and em dashes.
- Anchor comments inline where possible. Draft comments for human approval before posting.
