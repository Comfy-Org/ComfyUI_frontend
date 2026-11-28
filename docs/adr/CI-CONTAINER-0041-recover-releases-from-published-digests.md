# ADR-CI-CONTAINER-0041: Recover container releases from published digests

Date: 2026-10-09

## Status

Proposed

## Context

The CI container moves from `Comfy-Org/comfyui-ci-container` into this monorepo,
but existing consumers must retain their GHCR image name and pull access.
The old publisher creates a source tag before building. A failed build can
therefore leave a tag with no usable image. Rebuilding after an interrupted
upload can also replace a version with different bytes because base images
and apt packages still float.

## Decision

Use the published version's digest as the recovery record. Validate the image
before upload and again after pulling by digest. Create the source tag only
after remote validation, recording the digest in its annotation. Retries reuse
that digest and reject conflicting revision labels or source tags. Compatibility
aliases update last and can be repeated. A newer version blocks recovery of
an older release rather than moving aliases backwards.

One serialized, opt-in main workflow owns publication. An administrator must
grant access to the existing package and disable the old publisher first.
Keep container versions in their own `VERSION` file and namespaced Git tags;
do not create GitHub Releases that could trigger frontend release workflows.

We rejected passing PR-built images into a privileged workflow. Rebuilding
reviewed main source avoids trusting cross-run artifacts. We also rejected
tag-first publication because the source tag must identify an available image.

## Consequences

### Positive

- Recovery cannot rebuild and overwrite an existing version.
- Consumer updates remain independently reviewable and reversible.
- Python wheel hashes constrain dependency changes without coupling container
  releases to pnpm package versions.

### Negative

- First publication needs an administrator's package-access handover.
- Image upload, source tagging, and alias updates are not one transaction.
  An interruption can require a manual rerun against the original commit.
- Releases support amd64 only. Adding arm64 requires a validated dependency
  lock and candidate tests for that platform.
