# ADR-MEDIA-0001: Media sources hide format policy

Date: 2026-11-15

## Status

Proposed

## Context

A media file and its browser preview can be different resources. Treating
them as interchangeable makes downloads fetch thumbnails and makes image
elements request files the browser cannot decode. The two node renderers
also disagreed about explicit URLs supplied by extensions.

Source selection had spread across renderers, pickers and export dialogs.
Each caller needed to understand stored previews, backend transformations
and cloud sizing. Extracting another thumbnail helper would leave callers
responsible for assembling those decisions in the right order.

## Decision

Resolve media sources before presenting them. Keep the original file,
browser display, normal preview and compact thumbnail distinct. Report
pixel-editing availability with the resolved sources. A missing preview
means a placeholder, not permission to try an undecodable original.

Own format-dependent source selection and thumbnail transformations in one
module. Asset translation keeps its existing content identity, inline
playback and workspace-authentication rules. Downloads retain their
authenticated transport rather than replacing it with bare media fetches.

Preserve explicit output URLs, including intentional empty values, without
appending cache revisions or preview parameters. Generated node URLs retain
extension query fields and share one revision per output identity.

Keep decoder implementation and dedicated-viewer controls specialized.
Do not put loading state, widget geometry, exposure identity or navigation
inside the source descriptor.

## Alternatives considered

- Share only a thumbnail helper. Rejected because callers would still
  decide when an original can be displayed and how to retain file identity.
- Introduce a media-renderer hierarchy. Rejected because source selection
  needs plain data, not new ownership of DOM elements or canvas widgets.
- Route asset records directly through node-output URLs. Rejected because
  content IDs, grouped assets and workspace-scoped playback have different
  transport contracts.

## Consequences

Renderers and pickers consume sources instead of reconstructing format
rules. The original remains available behind stored or downscaled previews.
Changing a format's browser-preview policy has one owner.

Source resolution does not generate missing previews or add new decoders.
Those still require backend support or a specialized viewer. Asset records
use supplied thumbnail, supplied preview, stored preview and safe fallback
in that order; URLs known to address raw unsupported images are excluded
from browser-preview candidates.
