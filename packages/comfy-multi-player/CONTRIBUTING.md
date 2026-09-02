# Contributing to @comfyorg/comfy-multi-player

This package is the single shared op-to-Yjs-document applier for ComfyUI's
in-app agent and CRDT workflow state. Both the browser and the server run the
same code, so every change must preserve that contract.

## Before you change anything

Read [`docs/INVARIANTS.md`](docs/INVARIANTS.md). It defines the `KA-*`
(keep-alive) and `FC-*` (foreclose) invariants that govern op semantics,
replication, purity, and the document layout. Every change touching op
semantics, public exports, the dependency set, or the widget catalog **must
cite the affected `KA-*` and `FC-*` invariant IDs** in its PR description.
Deliberate deviations require an entry in
[`docs/decisions/EXCEPTIONS.md`](docs/decisions/EXCEPTIONS.md) before
implementation.

The normative reference for the document layout and op semantics is
[`docs/multiplayer-schema.md`](docs/multiplayer-schema.md). Where this README
or any other file disagrees with the schema document, the schema wins.

## Pull request structure

Every PR description must include these three sections — the PR template
(`.github/PULL_REQUEST_TEMPLATE.md`) provides them:

1. **Problem / Goal** — what is broken or what capability is missing.
2. **Proposed Solution** — what the change does and why this approach.
3. **Acceptance Criteria** — how a reviewer confirms the change is correct,
   including which `KA-*` / `FC-*` invariants are affected and how they are
   preserved.

## Local gate sequence

Run all nine commands before requesting review — this is the set CI runs:

```sh
npm ci
npm run build
npm run check:purity
npm run check:imports
npm run check:pins
npm run check:profile-claims
npm run check:coderabbit
npm run verify:corpus
npm test
```

`check:purity` asserts the production dependency roots are exactly `{yjs}` and
probes a bare-Node import for DOM globals. `check:imports` covers the same
contract per source module and exits `2` (INCONCLUSIVE, never a pass) when it
analyzed too few modules. `check:coderabbit` regenerates `.coderabbit.yaml`
from the `.agents/checks/*.md` blocks and fails on any byte difference — edit
the owning profile and run `npm run gen:coderabbit`, never the YAML directly.
`check:pins` holds cross-repo citations to SHAs in `docs/upstream-pins.json`.
`verify:corpus` checks that conformance fixtures match their pinned SHAs.

Add a fixture in `fixtures/` with any change to op semantics.

## Purity and portability

The op layer must run identically in a browser and in a bare Node server. Keep
it free of DOM, UI-framework, LiteGraph, and server-only dependencies. `yjs`
is the only permitted runtime dependency. Do not infer correctness from a
browser-only or Node-only run.

## Document layout changes

Any change to the `Y.Doc` layout or to `SCHEMA_VERSION` requires frontend
sign-off — the browser is a co-equal host of this document. Contract changes
are amendments appended to the schema document with reasoning, never silent
edits to a decided section.

## Where to send things that are not pull requests

- **Contract and API questions** — read
  [`docs/api-contract-proposal.md`](docs/api-contract-proposal.md) first, then
  open a GitHub Discussion rather than an issue.
- **Security reports** — use GitHub's private vulnerability reporting
  (Security tab → Report a vulnerability), not a public issue.
- **General questions** — open a GitHub Discussion.
