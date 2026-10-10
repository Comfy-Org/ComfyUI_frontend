# ADR-PACKAGES-MULTIPLAYER-0041: Import Multiplayer Before Switching Consumers

Date: 2026-10-08

## Status

Proposed

## Context

The frontend and Cloud doc host must execute the same multiplayer semantics.
Moving their shared package does not make their deployments atomic. At import,
the frontend pins npm 0.3.6, Cloud main pins 0.3.7, and the package is 0.3.10.
These repository pins do not establish what is deployed.

## Decision

Import `Comfy-Org/comfy-multi-player` into `packages/comfy-multi-player` with
its original Git ancestry, license, tests, fixtures, and decisions. Keep the
frontend on its existing npm version in the import PR. A stacked draft PR
switches it to `workspace:*` only after Cloud alignment is verified.

Workspace consumers resolve TypeScript source. External consumers continue
to install compiled ESM and declarations from npm. `pnpm pack` applies
`publishConfig.exports` and replaces catalog references before publication.
The package retains its own lint rules and bare-Node test environment.
Frontend formatters must not rewrite the imported tree. Existing package ADR
identifiers remain in their own namespace, outside the root ADR renaming check.

Keep the package's release recovery and provenance verification rather than
replacing them with the generic SDK publisher. The package uses the same
human-approved `Release` version-bump PR convention, with its own
`comfy-multi-player-v*` tags. Initial import and unchanged-version merges do
not publish. Package releases never become the frontend's GitHub Latest release.

Before the first monorepo release, a maintainer must configure npm's trusted
publisher and tag protection. Publish a version newer than 0.3.10, pin it in
Cloud, and verify browser/host conformance and rollout order before enabling
workspace consumption. Retiring the standalone repository is a separate action.

## Alternatives

Importing and switching consumers together would hide a semantic upgrade
inside a repository move. Keeping both repositories writable indefinitely
would leave two sources of truth. Replacing the release verifier would lose
its existing checks for conflicting registry artifacts and interrupted releases.

## Consequences

The import is independently reviewable and does not change frontend runtime
behavior. Future package changes still require coordinated Cloud releases;
sharing a workspace removes local npm iteration, not that release obligation.

This is a scoped exception to the generic publisher in
[ADR-RELEASES-PACKAGES-0033](RELEASES-PACKAGES-0033-sdk-packages-release-through-version-bump-prs.md).
