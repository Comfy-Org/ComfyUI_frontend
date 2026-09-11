# ADR-WEBSITE-OUTPUTS-0032: Raster previews for vector generation

Date: 2026-09-11

## Status

Proposed

## Context

Seven Recraft pages generated valid SVG files, but the page kept those outputs
as inert downloads and the image verifier correctly found no previewable image.
SVG can contain active document content. Treating it as an ordinary passive
image response would weaken the existing output boundary.

## Decision

Render bounded SVG documents through an off-DOM browser image and canvas, then
preview the PNG. Keep the original bytes as an octet-stream download. Reject
document types, invalid XML and excessive dimensions; bound download size,
processing time and concurrent CLI renderers. Revoke temporary object URLs on
success, failure and cancellation.

Inject only the SVG rasterizer into the existing shared response parser. The
browser uses the local module directly. The Node verifier runs that same module
in Playwright Chromium, then downloads and decodes the PNG with the existing
artifact checks. Real browser tests verify that scripts and external references
do not execute or issue requests.

Rejected alternatives are inline SVG/iframe previews, treating every SVG MIME
as passive, and a separate server renderer whose behavior could diverge from the
page. Retain the existing strict native response validation for other content.

## Consequences

The page and verifier can display vector-model output without active SVG in the
page DOM. Saved generation responses can be rechecked without a new paid call.
The CLI requires Chromium for these outputs, and the preview uses bounded
raster memory. Unsupported documents remain downloads rather than image passes.
