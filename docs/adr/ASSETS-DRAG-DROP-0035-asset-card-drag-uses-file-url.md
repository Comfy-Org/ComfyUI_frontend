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
`preview_url` or a `preview_id` naming a separate thumbnail asset. The cloud
backend builds a `preview_url` for images only, and that URL points at the
image file itself (a self-preview). Video, audio and 3D assets get no preview
unless a client persisted a thumbnail, in which case `preview_id` points at a
PNG that is not the file. Any rule that lets a preview stand in for the file
therefore works for images and fails for every other kind.

A dragged card publishes two flavours: `application/x-comfy-asset-info` (the
asset's filename, display name, media kind, attachment reference and, for
images, a preview URL) and `text/uri-list`. Node drop targets that declare
`onResultItemDrop` consume the asset-info payload and never touch the URI.
The URI matters to the canvas drop path, which fetches it and hands the
result to `handleFile`, and to node targets without `onResultItemDrop`, which
fetch it and derive a `File`.

`MediaAssetCard`'s `dragStart` published `resolvePreviewUrl(asset)` as the
URI. Images worked by accident. A job-grouped video with no preview fell back
to `/api/assets/{jobId}/content`, which the backend answers with a 404 JSON
error. A 3D asset with a persisted thumbnail handed over the thumbnail PNG.
`fetchDroppedAsset` then wrapped whatever the fetch returned, including that
JSON error body, in a `File`, so the canvas tried to load
`{"code":"ASSET_NOT_FOUND"}` as a workflow and showed an invalid-workflow
error. A node target without `onResultItemDrop` named the fetched `File`
after the last URL segment, which for a content URL is the literal `content`.

## Decision

1. The drag URI names the asset's file, never a preview. The drag side builds
   `text/uri-list` from `getAssetFileUrl(asset)`, which resolves the file
   through `getAssetContentId` (`user_metadata.assetId || asset.id`). The
   rule is media-kind agnostic: no consumer may assume a preview is the file,
   even when a preview exists.
2. Previews stay a rendering concern. `application/x-comfy-asset-info` keeps
   `preview_url` for image previews, and `resolvePreviewUrl` remains the
   source for `<img>` and `<video>` elements. Its own fallback resolves
   through `getAssetContentId` as well, so no code path derives a content URL
   from a job id.
3. Drop consumers take the display name from the asset-info payload, not
   from the URI. `useNodeDragAndDrop` prefers `parseAssetInfo(...).filename`
   and falls back to the URL-derived name only for drags that carry no
   asset-info flavour.
4. The payload belongs to the asset, not to a view mode. Both flavours are
   written by one function, `startAssetDrag` in
   `platform/assets/utils/assetDragUtil.ts`, which derives everything from
   the `AssetItem` alone. Every surface that lets a user drag an asset out of
   the panel calls it: the grid's `MediaAssetCard` and the list rows in
   `AssetsSidebarListView`. A surface that renders assets without calling it
   is a silent attachment failure, because the drop side accepts a drop by
   looking for `application/x-comfy-asset-info` in `dataTransfer.types` alone
   (`AgentPanelRoot` `isAssetDrag`) and a row that never starts a drag
   advertises nothing. PM-1401 was exactly that: list view rendered
   `AssetsListItem`, which set no `draggable` and no `dragstart`, so dragging
   an asset onto the agent prompt did nothing while the panel was in list
   view and worked in grid view.
5. A non-OK response is not a file, and the user is told. `fetchDroppedAsset`
   returns `undefined` on `!response.ok` (status-based, never content-type
   sniffing). The canvas drop handler, when a drop that carried the
   asset-info flavour yields no file, reports the failure through
   `reportError` and shows a toast instead of a silent no-op. Drops that
   never carried asset-info (plain links from elsewhere) stay silent.

### Alternatives considered

- Fix only `resolvePreviewUrl`'s fallback to use the file's content id.
  Rejected as the whole fix: it removes the 404 but the drag would still
  hand over a preview whenever one exists, as with a persisted 3D thumbnail.
  Adopted only as the supporting tightening in rule 2.
- Wait for the backend to populate previews for video. Rejected: a preview is
  still not the file; the drop would then deliver a poster frame to the
  canvas.
- Special-case video in `dragStart`. Rejected: the failure applies to audio,
  3D and any future kind. One rule covers them all.

## Consequences

### Positive

- Dropped video, audio and 3D cards carry their real file, so embedded
  workflow metadata loads on the canvas and node targets receive a `File`
  with its real name.
- A failed fetch surfaces as a toast plus a telemetry report instead of a
  misleading invalid-workflow error.
- No server change is needed.

### Negative

- The card's `id` stays the job id, which remains a trap for new consumers.
  `getAssetFileUrl` and `getAssetContentId` are the sanctioned resolvers;
  nothing else should derive a content URL from `asset.id`.
- Node targets without `onResultItemDrop` (for example `LoadAudio`) still
  re-upload the fetched file rather than referencing the existing asset.
  Adding `onResultItemDrop` to those targets is a follow-up, not part of this
  decision.
- Nothing mechanically forces a new asset surface through `startAssetDrag`; a
  future view mode can still ship undraggable rows. The guard is coverage,
  not a lint: each surface owns a case asserting it publishes the payload.
- `startAssetDrag` cancels the drag under Ctrl/Meta because those modifiers
  belong to panel selection. In list view the marquee never engages today
  (`useAssetGridSelection` tracks only containers holding `[data-asset-id]`,
  which list rows deliberately do not set), so that branch is parity with the
  grid rather than a behaviour list view currently needs.
