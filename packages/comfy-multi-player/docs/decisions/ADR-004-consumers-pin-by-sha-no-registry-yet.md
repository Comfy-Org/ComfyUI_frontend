# ADR-004: Consumers pin by git SHA; no registry publish yet

**Status:** Superseded by [ADR-006](ADR-006-publish-to-npm-pin-exact-versions.md)
**Date:** 2026-08-20
**Invariant:** KA-1, FC-3 (both hosts run the *same* applier bytes)

## Context

Both hosts of this document — the browser (ComfyUI frontend) and the stateless
Node doc-host sidecar in cloud — must run the identical op-to-document
implementation (ADR-001). Consumers therefore need a way to depend on this
package that makes "same bytes on both hosts" mechanically checkable, without
prematurely committing to a registry and publish pipeline while the schema and
op vocabulary are still stabilizing.

The cloud doc-host already consumes the package as a git dependency pinned by
immutable SHA (`services/agent/dochost/package.json`). The open question was how
the frontend consumes it, and whether a registry publish is a prerequisite.

Verified 2026-08-20 (frontend `poc/fe-crdt-follower`, PR #15457):

- The package installs cleanly as a git-SHA dependency and ships **both** the
  `dist` type declarations and the runtime — no separate types package or build
  step on the consumer side beyond the package's own `prepare`.
- The frontend lockfile now pins the **same SHA** the cloud doc-host runs, so
  the KA-1/FC-3 "one applier, both hosts" property is enforced by the lockfile,
  not by convention.
- The follower (a read-only client) consumes only the doc-layout helpers
  (`nodesMap`, `linksMap`, `OPAQUE_WIDGETS_KEY`) — it never imports `applyOps` /
  `project`, because a follower never writes the shared doc (KA-6). Consuming
  the package for *types and layout* does not imply running the applier.

  **Amended 2026-08-20 (see [ADR-005](ADR-005-read-only-snapshot-surface.md)):**
  that bullet describes the surface at the pinned SHA `6793d754`. Issue #18
  removed most doc-layout helpers from the entrypoint; the ADR-004 follower trio
  remains public for compatibility. ADR-005 adds `readGraph()` as the safer
  migration target: unlike `nodesMap`, it returns plain frozen data. **With one
  caveat a migrating follower must handle:** `nodesMap` never throws, and
  `readGraph` does — it carries the KA-11 read gate (Amendment A12), so a
  document carrying content under an unreadable schema now refuses instead of
  being read with v1 key names. A follower swapping one for the other must keep
  its own schema guard or catch `SchemaVersionError` at the seam that handles
  schema errors today, since that seam rethrows anything it does not recognise.
  The conclusion stands — a follower consumes this package for layout and never
  runs the applier — while a lockstep pin bump can move it off live handles.

## Decision

Consumers depend on this package by **immutable git SHA**, and the package is
**not published to a registry yet**.

- Pin by SHA: `npm install github:Comfy-Org/comfy-multi-player#<sha>` (pnpm:
  `github:Comfy-Org/comfy-multi-player#<sha>`).
- The frontend and the server MUST pin the same SHA. This is load-bearing for
  outcome agreement, not just hygiene (ADR-001; README "Install").
- A git dependency runs this package's `prepare` script to build `dist` on
  install. Consumers whose package manager gates install-time build scripts must
  allow this build explicitly. For pnpm this is an `allowBuilds` entry in
  `pnpm-workspace.yaml` keyed by the fully-resolved git spec, e.g.
  `'@comfyorg/comfy-multi-player@git+ssh://…#<sha>': true`. Document this in the
  consumer, not here — it is a consumer-side supply-chain policy.
- Do not add a second implementation or a prebuilt fork to work around the build
  step (that would risk FC-3). If the build-on-install cost becomes a real
  problem, prefer publishing a prebuilt artifact (below) over vendoring.

## Consequences

- "Same applier on both hosts" is enforced by each consumer's lockfile pinning
  the same SHA; a mismatch is visible in review as a lockfile diff.
- Consumers pay a one-time `prepare` build on install and must allowlist it
  under strict supply-chain policies.
- No registry means no version-range resolution: bumping the applier is an
  explicit SHA bump in each consumer, which is the intended friction while the
  contract is still moving (it forces a deliberate, reviewable step).

## Future option (not adopted now)

Publish a **prebuilt** artifact to GitHub Packages (npm registry scoped to the
org) once the contract stabilizes. That would ship `dist` without a consumer
build step (removing the `allowBuilds`/`prepare` requirement) and give ranged
versioning, at the cost of a publish pipeline and registry-auth setup in every
consumer's CI. Revisit when the schema/op vocabulary churn slows. Publishing
does not change the KA-1/FC-3 requirement that both hosts run the same version.

## Open follow-up

- Confirm consumer **CI** can resolve this private git dependency (a local
  developer install works via SSH/`gh` auth; CI needs a token with read access
  to the private repo). This is a consumer-CI concern, tracked in the frontend.

## Alternatives considered

- **Publish to a public/registry now:** rejected as premature while the schema
  and op vocabulary are still amended frequently; ranged versioning would invite
  accidental drift between the two hosts.
- **Vendor a prebuilt copy into each consumer:** rejected — a checked-in build
  is a second source of truth that can drift from the SHA and quietly violate
  FC-3.
- **Split a separate `-types` package:** rejected as unnecessary; the single
  package already ships `dist` types, and a follower needs types + layout
  helpers from the same place the host gets its runtime.
