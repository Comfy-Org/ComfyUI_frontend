# ADR-ASSETS-DRAG-DROP-0035: Asset Card Drag-and-Drop Uses the File URL, Never the Preview URL

Date: 2026-09-19

## Status

Proposed

## Context

With the cloud assets API enabled, the Media Assets panel groups per-file
output assets by job (`unflattenOutputAssets`). The card's `id` becomes the
job id; the file's own asset id survives only as `user_metadata.assetId` and
inside `allOutputs`.

An asset has up to two server resources: its file
(`/api/assets/{assetId}/content`) and an optional preview, either a
`preview_url` or a `preview_id` naming a separate thumbnail asset. The backend
builds a `preview_url` for images, and that URL happens to serve the image
file itself. Video, audio and 3D assets get no preview unless a client
persisted a thumbnail, in which case `preview_id` points at a PNG that is not
the file.

`MediaAssetCard`'s `dragStart` published `resolvePreviewUrl(asset)` as the
`text/uri-list` payload that canvas and node drop handlers fetch. Images
worked by accident. A job-grouped video with no preview fell back to
`/api/assets/{jobId}/content`, which the backend answers with a 404 JSON
error. A 3D asset with a persisted thumbnail handed over the thumbnail PNG.

`fetchDroppedAsset` then wrapped whatever the fetch returned, including that
JSON error body, in a `File`, so the canvas tried to load
`{"code":"ASSET_NOT_FOUND"}` as a workflow and showed an invalid-workflow
error for a drop that never contained a workflow.

## Decision

- The drag payload's `text/uri-list` value is always `getAssetFileUrl(asset)`,
  which resolves the file through `user_metadata.assetId || asset.id` and
  never consults a preview. The rule is media-kind agnostic.
- Previews stay a rendering concern. `application/x-comfy-asset-info` keeps
  `preview_url` for image previews (the agent composer reads it), and
  `resolvePreviewUrl` remains the source for `<img>` and `<video>` elements.
- Drop handlers that turn a URI into a `File` treat a non-OK response as no
  file. `useNodeDragAndDrop` already does; `fetchDroppedAsset` follows.

### Alternatives considered

- Fix only `resolvePreviewUrl`'s fallback to use the file's content id.
  Rejected: it removes the 404 but the drag would still hand over a preview
  whenever one exists, as with a persisted 3D thumbnail. The drag must never
  use a preview.
- Wait for the backend to populate previews for video. Rejected: a preview is
  still not the file; the drop would then deliver a poster frame to the
  canvas.
- Special-case video in `dragStart`. Rejected: the failure applies to audio,
  3D and any future kind. One rule covers them all.

## Consequences

### Positive

- Dropped video, audio and 3D cards carry their real file, so embedded
  workflow metadata loads on the canvas.
- A failed fetch is a no-op instead of a misleading invalid-workflow toast.
- No server change is needed.

### Negative

- Failed drops are now silent. Whether to surface a toast is deferred to a
  follow-up.
- The card's `id` stays the job id, which remains a trap for new consumers.
  `getAssetFileUrl` is the sanctioned resolver for the file; nothing else
  should derive a content URL from `asset.id`.
