# ADR-006: Publish to npm; consumers pin exact published versions

**Status:** Accepted
**Date:** 2026-08-22
**Invariant:** KA-1, FC-3 (both hosts run the *same* applier bytes)
**Supersedes:** ADR-004

## Context

ADR-004 chose immutable git-SHA dependencies while the package contract was
stabilizing and no registry release existed. The package is now published to
npm as `@comfyorg/comfy-multi-player@0.1.0`, so consumers no longer need a git
checkout or an install-time `prepare` build.

At this decision's 2026-08-22 acceptance, `0.1.0` was the published release.
The repository manifest is currently version `0.2.1` with the
`GPL-3.0-only` license; this current-state note does not announce or perform a
new npm release.

All three consumers use the registry release: ComfyUI frontend, the cloud
`services/agent/dochost` sidecar on `main`, and the `examples/dochost` example
merged in PR #27. Git-SHA pinning has therefore been retired in practice.

## Decision

Publish `@comfyorg/comfy-multi-player` to the npm registry and have every
consumer pin an exact published version. At acceptance, the shared published
version was `0.1.0`; the repository manifest is currently `0.2.1`.

Version updates remain explicit, reviewable changes in each consumer. The
frontend, cloud doc-host, and examples MUST use the same exact package version
where they rely on identical applier behavior (ADR-001).

## Consequences

- Package updates flow through normal npm semantic-version pins and lockfile
  updates rather than git-SHA dependency changes.
- Exact pins preserve the lockstep behavior required by KA-1 / FC-3; consumers
  do not use version ranges for the shared applier.
- Publishing a new version is an explicit maintainer action with its own
  cadence, separate from merging repository changes.
- The repository manifest and `LICENSE` now identify the package as
  `GPL-3.0-only`; the earlier pending `0.1.1` license-metadata plan is historical
  and no longer current.
- Consumers install the prebuilt registry artifact and no longer need to allow
  this package's git-dependency `prepare` script.

## Alternatives considered

- **Keep pinning git SHAs:** rejected because the published package removes the
  consumer build and git-auth requirements while exact versions retain
  deliberate lockstep upgrades.
- **Use semver ranges:** rejected because independent resolution could put the
  browser and host on different applier versions and violate FC-3.
- **Vendor a prebuilt copy into each consumer:** rejected because it creates a
  second source of truth that can drift from the published package.

## Amendment (2026-09-21): the `release` label is the deliberate act

"Publishing a new version is an explicit maintainer action with its own
cadence, separate from merging repository changes" stands. This amendment
changes *where* that action is taken, not *whether* it is taken.

Previously the separation was carried by two git commands a maintainer ran by
hand after merging a version-bump PR (`git tag v<version>` and `git push`).
Those commands were not themselves a decision: the decision had already been
made when the maintainer reviewed and approved the version bump. They were
toil after the fact, and forgetting them left `main` claiming a version that
was never published (as `0.3.1` did).

The deliberate act now lives on the pull request:

- A maintainer applies the `release` label to a version-bump PR and approves
  it. Both are required, both are explicit, and both are recorded on the PR.
- On merge, `.github/workflows/auto-tag-release.yml` creates `v<version>` at
  the merge commit and dispatches `release.yml` at that tag. It refuses to act
  if the PR did not actually change `package.json`'s version, and it never
  moves or replaces an existing tag.
- Every other merge to `main` publishes nothing. Auto-tagging on any merge to
  `main` was considered and rejected for exactly the reason this ADR gives:
  merging is not publishing.

This narrows the manual step, it does not remove the decision. A maintainer
who does not label a PR gets the old behaviour — merge publishes nothing, and
the release is cut by hand. Consumers still pin exact published versions;
nothing about the lockstep requirement in KA-1 / FC-3 changes.

## Amendment (2026-10-08): releases move into the frontend monorepo

The package source now lives in `Comfy-Org/ComfyUI_frontend` under
`packages/comfy-multi-player`. The decision above is unchanged: npm is the
distribution channel, consumers pin exact versions, and the deliberate act is
a maintainer labelling and approving a version-bump PR. What changes is the
release identity:

- The label is the frontend's existing `Release` label. Because that label
  also marks frontend release PRs,
  `.github/workflows/publish-comfy-multi-player-on-merge.yaml` runs only when
  `packages/comfy-multi-player/package.json` changes, and a labelled merge
  that leaves its version unchanged is a no-op notice rather than a failure.
  The merge that imports the package creates that manifest and tags nothing.
- Release tags are `comfy-multi-player-v<version>`. Bare `v<semver>` tags in
  this repository are frontend releases.
- `.github/workflows/publish-comfy-multi-player.yaml` publishes. npm
  provenance for new versions names `Comfy-Org/ComfyUI_frontend`, that
  workflow path, and the tag ref, and `scripts/release-retry.mjs` verifies
  exactly that identity before treating an existing registry version as this
  release. Versions up to `0.3.10` carry the standalone repository's
  provenance, so recovery of those versions from this repository fails closed
  by design.
- `pnpm pack` builds the tarball so `publishConfig.exports` replaces the
  source `exports` used inside the workspace and `catalog:` specifiers become
  concrete ranges. npm 11.19.0 then publishes that exact tarball, which keeps
  npm's trusted-publishing and attestation behavior, and the disposable-consumer
  `npm audit signatures` check is unchanged.
- The GitHub release is created with `--latest=false`, because the frontend's
  Latest release is what `--front-end-version latest` resolves to.

Publishing from this repository requires the npm trusted-publisher entry for
`@comfyorg/comfy-multi-player` to name `Comfy-Org/ComfyUI_frontend` and
`publish-comfy-multi-player.yaml`, and the `comfy-multi-player-v*` tags to be
protected against moves and deletion. Both are maintainer settings outside
this repository's code.
