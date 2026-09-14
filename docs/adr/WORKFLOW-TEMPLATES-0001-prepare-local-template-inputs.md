# ADR-WORKFLOW-TEMPLATES-0001: Prepare local template inputs before opening

Date: 2026-09-14

## Status

Proposed

## Context

Official templates reference sample filenames. Their Python packages contain
workflow JSON and previews, while the sample inputs live separately in the
templates repository. Cloud provisions these files as shared assets; local
and Desktop template browsing previously opened graphs without provisioning
their inputs.

## Decision

Prepare declared sample inputs in the shared frontend template loader before
opening a local or Desktop graph. Download from the official repository and
upload through the connected backend's existing file-upload endpoint. Honor
the returned filename and refresh input options before missing-media detection.

Use the catalog's existing `io.inputs` declarations and the built-in media
loaders. Do not infer downloads from arbitrary imported workflows. The initial
scope is root-node declarations, matching the catalog generator's coverage.

Keep failure reporting at the loader boundary and leave the previous workflow
open so a template click can retry. Cancel superseded preparation. Preserve
local files through the backend's content deduplication and collision renaming.

Packaging every sample would increase installation size even for unused
templates. Desktop-only IPC would omit browser-based local installations.
A new backend URL-download endpoint is unnecessary for the existing upload
contract and would introduce another remote-fetch boundary.

## Consequences

The same template card and URL entry points can prepare local inputs without a
backend or Desktop release dependency. Opening a template can take longer and
requires access to the sample host. Media passes through browser memory; a
streaming backend path may be warranted for larger assets in the future.

Repeated opens can reuse HTTP caching and backend content deduplication, but
still perform an upload. The sample URLs currently follow the template
repository's main branch rather than a versioned content digest.
