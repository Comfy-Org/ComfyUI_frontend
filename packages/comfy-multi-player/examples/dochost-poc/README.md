# Document-host package parity harness

This harness compares the checked-out CMP build with that exact package installed
in the real cloud document-host sidecar. It tests loopback HTTP and document
semantics, **not browser behavior or deployment readiness**.

## Run

Use Node 22+ and a compatible checkout of `Comfy-Org/cloud` with
`services/agent/dochost`. Install this repository's development dependencies first:

```bash
npm ci
DOCHOST_SRC=/path/to/cloud/services/agent/dochost ./examples/dochost-poc/run.sh
```

The launcher builds and packs this checkout, prints the artifact SHA-256, and
copies the sidecar source into a disposable directory. All sidecar installation,
build and execution happen there. It installs the tarball over the sidecar's
registry dependency, verifies every installed `dist` file and the package manifest
against the tarball, verifies import resolution and one shared Yjs dependency,
then starts the sidecar. It never installs into or deletes dependencies from
`DOCHOST_SRC`. The temporary directory and child server are cleaned up on exit.

An incompatible sidecar fails at build or comparison; the launcher does not patch
the consumer or fall back to an older package. Version equality alone is not
artifact identity. Record both repositories' exact revisions and the printed
artifact digest when saving a test result.

```diagram
Checked-out package ── pack ──► disposable sidecar ──► HTTP results
         │                            │                    │
         │                       one snapshot              │
         │                            │                    │
         └──── direct apply ◄─────────┘                    │
                     └──── outcomes + projection compare ─┘
```

## Checks and limits

- A human seed edit and an agent node-plus-link batch both apply, with their
  actual graph effects checked independently of result parity.
- Each ordered `ApplyResult` matches the direct build: operation identity,
  outcome, stable rejection code and `ops_seen`. Human-readable error prose is
  deliberately excluded. Legacy-only result shapes fail.
- Projections match after each batch. A real unknown-widget refusal aborts a
  valid trailing operation; folding its returned delta must leave encoded state
  byte-identical and must not record the trailing operation in `__applied`.
- Followers consuming only host deltas converge; duplicate and reversed delta
  delivery preserve the projection.

All direct comparisons fork from the **same server-minted snapshot** and prior
host deltas. Direct-comparison updates never enter the host or follower stream
(KA-10, KA-6, FC-1). There is one shared applier implementation (KA-3/FC-3).
Object key order is immaterial; outcome and array order remain significant.
See [the invariants](../../docs/INVARIANTS.md).

`PORT` defaults to `8095`; the launcher refuses an already healthy service on that
port. When invoking the driver alone, `DOC_HOST` selects the HTTP endpoint and
`CMP_PIN` selects the local checkout containing fixtures, `dist` and dependencies.
**A driver-only run does not verify the server's installed artifact identity.**

The real sidecar run is manual, not part of CI. Automated harness regressions use
explicit launcher fakes and a small HTTP fixture; their results are not real
cloud acceptance evidence. No browser, canvas, WebSocket, agent turn loop,
authentication or persistence is exercised. Browser-visible changes still need
separate consumer QA. This example makes no claim about which frontend clients
exist on other branches.

Glossary: CMP = the standalone `@comfyorg/comfy-multi-player` package;
sidecar = cloud's Node document host; parity = matching results across execution
paths; artifact = the package tarball; snapshot = shared initial Yjs document
bytes; QA = quality assurance; CI = automated repository checks.
