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

Run these ten commands before requesting review, including both CI test tiers.
Install from the repository root, then run the rest in
`packages/comfy-multi-player`:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run check:purity
pnpm run check:imports
pnpm run check:pins
pnpm run check:profile-claims
pnpm run check:coderabbit
pnpm run verify:corpus
pnpm test
pnpm run test:exhaustive
```

`check:purity` asserts the production dependency roots are exactly `{yjs}` and
probes a bare-Node import for DOM globals. `check:imports` covers the same
contract per source module and exits `2` (INCONCLUSIVE, never a pass) when it
analyzed too few modules. `check:coderabbit` regenerates `.coderabbit.yaml`
from the `.agents/checks/*.md` blocks and fails on any byte difference — edit
the owning profile and run `pnpm run gen:coderabbit`, never the YAML directly.
`check:pins` holds cross-repo citations to SHAs in `docs/upstream-pins.json`.
`verify:corpus` checks that conformance fixtures match their pinned SHAs.

Add a fixture in `fixtures/` with any change to op semantics.

## Permutation test tiers

`pnpm test` retains representative full-op-pool coverage: 64 frozen-kind pairs ×
8 states × 2 arrival orders × 2 batch modes = 2,048 executions, rotating the
actor/stamp classes across pairs, plus 128 fixed-seed length-3-to-6 streams
(256 executions). Both tests keep the rejection, idempotency, taxonomy, and
measured-count assertions; coverage guards require every kind/state, actor
class, stamp class, batch mode, and sampled declared kind to be exercised.

Also run `pnpm run test:exhaustive` before review. This selects the `exhaustive`
Vitest tag and preserves the full current domain: 16,384 pair executions
(the same dimensions × 2 actor classes × 4 stamp classes) and 1,696 fixed-seed
streams (3,392 executions). The independent `exhaustive op-pool permutations`
CI job runs on every PR and main push, and its failures fail the workflow.
Neither command claims exhaustive coverage of arbitrary workflows or streams.

This separation carries the `coderabbitai[bot]` request from
[the September 2, 2026 frontend review](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16644#pullrequestreview-5089967939):
“Isolate the exhaustive permutation tests in the suite containing the
900,000 ms timeouts and 200,000-operation matrix by assigning them a dedicated
job or test tag, while retaining a reduced representative sample in the default
test run.” The matrix was already reduced before this scheduling change.
That closed frontend migration PR and its QA records are historical recovery
evidence, not current standalone-package QA or authorization to migrate,
publish, or deploy. Historical mutation scores likewise do not measure this
new default selection; no new mutation score is claimed here.

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

## Cutting a release

Releases are cut from a **version-bump-only PR**: the `version` in
`packages/comfy-multi-player/package.json` and a `CHANGELOG.md` entry, nothing
else. Apply the **`Release` label** to that PR before merging it. The label is
the deliberate publish decision. See the amendments in
[`docs/decisions/ADR-006-publish-to-npm-pin-exact-versions.md`](docs/decisions/ADR-006-publish-to-npm-pin-exact-versions.md).

The `Release` label also drives frontend releases, so the PR must not touch
the root `package.json`; doing so would start the frontend release workflows
too.

When a labelled PR merges,
`.github/workflows/publish-comfy-multi-player-on-merge.yaml` creates
`comfy-multi-player-v<version>` at the merge commit and starts
`.github/workflows/publish-comfy-multi-player.yaml` at that tag. That workflow
runs the full gate suite, packs with `pnpm pack` (which applies
`publishConfig.exports` and resolves `catalog:` versions), and publishes the
packed tarball to npm with provenance. A labelled merge that leaves the version
unchanged tags nothing.

Merging **without** the label publishes nothing, which is the intended default
for every other change. To release such a merge afterwards, tag it by hand:

```sh
version="$(node -p "require('./packages/comfy-multi-player/package.json').version")"
git tag "comfy-multi-player-v$version" <merge-sha>
git push origin "comfy-multi-player-v$version"
```

A tag pushed by a human still triggers the publish workflow on its own. If a
tag already exists but the release never ran, start it without re-tagging:

```sh
gh workflow run publish-comfy-multi-player.yaml --ref comfy-multi-player-v<version>
```

Dispatch at the **tag**, never at a branch: the run's ref is checked against
`package.json` and is recorded in the published npm provenance, so a branch
dispatch fails the first gate by design. Never push a bare `v<version>` tag for
this package: in this repository those tags are frontend releases. The
standalone-era `v<version>` tags stay in `Comfy-Org/comfy-multi-player`, and
versions up to `0.3.10` carry that repository's provenance, so the first
release from this repository must be a new version.

## Where to send things that are not pull requests

- **Contract and API questions** — read
  [`docs/api-contract-proposal.md`](docs/api-contract-proposal.md) first, then
  open a GitHub Discussion rather than an issue.
- **Security reports** — use GitHub's private vulnerability reporting
  (Security tab → Report a vulnerability), not a public issue.
- **General questions** — open a GitHub Discussion.
