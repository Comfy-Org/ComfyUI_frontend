# 27. Asset Record and Content Lifecycles

Date: 2026-08-27

## Status

Accepted

This ADR formalizes the current Assets record/content design and records where
the frontend has not adopted it. It does not add asset/job lifecycle semantics
that are absent from the design or implementation.

## Context

The Assets design separates a user-visible asset record from the content row
that describes bytes at a storage location. Multiple records may reference one
content row. An asset record owns labels and interpretation such as its name,
tags, metadata, optional preview relationship, and `job_id`; the content row
owns path, size, modification time, hash, and missing state.

For generated outputs, `job_id` records the prompt associated with that
record's creation event. It is informational provenance, not an ownership or
lifecycle foreign key. A record may retain a `job_id` after its prompt is no
longer present in transient history. The Asset API does not provide a
job-to-outputs query; in-memory history remains the current mechanism for
showing a run's outputs during that session.

## Current Implementation

The frontend does not yet present generated outputs as an independent Asset API
listing. The output tab reads `historyAssets`, which are reconstructed from
`/history`. Its initial output items use job-derived IDs; some expanded cloud
outputs can later be overlaid with real asset-record IDs from the job-assets
integration endpoint.

When a user confirms deletion of an output or temp item,
`useMediaAssetActions.deleteAssets` reads `user_metadata.jobId` (falling back to
the displayed item's ID) and calls `api.deleteItem('history', jobId)`. The API
helper posts `{ "delete": [jobId] }` to `/history`. This removes history by job
ID; it does not call `DELETE /api/assets/{id}` to delete an asset record.

Individual history deletion and clear history also post to `/history`. Current
product copy says those operations do not delete generated assets and that the
assets remain available in the assets panel. However, because the output tab is
history-derived, removing history can hide those outputs from that panel. The
frontend therefore exposes history deletion as output deletion while also
promising that assets survive it.

## Decision

1. **Asset records and content have separate identities.** Multiple records may
   reference one content row, and records for cached reruns may carry different
   `job_id` values while sharing content.
2. **Deleting through the Asset API deletes one record.**
   `DELETE /api/assets/{id}` hard-deletes the target asset record. It leaves the
   content row and file intact and never deletes another asset record.
3. **Preview references do not imply ownership.** Deleting a record that names
   a preview leaves the preview record intact. Deleting the preview record
   clears incoming preview references rather than deleting their records.
4. **`job_id` records provenance only.** It does not make history the lifecycle
   owner of an asset record or make an asset record the owner of history.
5. **History deletion has no asset-record cascade in this ADR.** Simon's design
   does not specify such a cascade, and the current frontend copy says assets
   survive history deletion. Whether another product contract should cascade,
   retain, or separately disclose records and bytes requires an explicit
   domain decision and backend evidence.

### Update, 2026-08-29 (Assets PR meta-review meeting, 2026-08-27)

The team settled the output Delete action semantics that this ADR previously
left open:

6. **The output Delete action becomes asset-record deletion.** Delete
   deregisters the asset record through `DELETE /api/assets/{id}` using a real
   asset-record ID. It does not delete files off disk. This was confirmed as
   working as intended, with the stated goal of minimal behavior change
   relative to the pre-assets hide behavior.
7. **Batch deletion resolves targets before execution and is non-atomic.** All
   files are resolved and reported before execution. Successful record
   deletions are not rolled back if another deletion in the batch fails. If any
   deletion fails, the owning job's history entry remains; history deletion per
   job is gated on every record deletion succeeding.
8. **Success copy must not claim disk deletion.** A toast that says assets
   were deleted when nothing was removed from disk is a bug. The server
   currently provides no discriminated return for cases where nothing was
   deleted, so the copy must reflect deregistration.
9. **A feature flag tells the frontend what delete will do.** The flag is
   acknowledged as poorly named (it previously meant something different); it
   gates behavior, and any rename is a separate cleanup.

## Current Gaps

- **Action semantics:** Decided at the 2026-08-27 meta-review (see Update
  above). The output Delete action becomes record deletion through a real
  asset ID, deregister-only, with history deletion per job gated on record
  success. Implementation lands in the deletion PR; comments there are to be
  closed out and re-reviewed with this understanding.
- **Listing semantics:** The output panel is history-derived, so it cannot prove
  that records outlive transient history or keep surviving records visible.
- **Identifier coverage:** Not every displayed output has a real asset-record
  ID. Job-derived and synthetic IDs must not be sent to the Asset API.
- **Distribution coverage:** The frontend currently uses the Asset API delete
  path for cloud input assets, while output and temp items use history deletion.
  The adopted record-deletion behavior across cloud and OSS remains incomplete.
- **History behavior:** The effect of history deletion on asset records in each
  backend distribution is not established by this frontend repository. It
  needs direct backend verification before stronger lifecycle claims are made.

## Consequences

- Asset-record deletion code and tests can rely on record-only hard deletion;
  they must not infer deletion of content, files, sibling records, or history.
- A later scan may create a new record for content whose old record was deleted;
  the deleted record identity is not revived.
- Generated-output UI cannot claim to delete an asset record while it sends a
  job ID to `/history`.
- Product copy, listing behavior, and requests must be reconciled with the
  decided semantics: record deletion through real asset IDs, deregister-only,
  no disk-deletion claims in success copy.
- A future asset/job cascade requires its own evidence and decision; it is not
  an accepted invariant merely because `job_id` exists.

## References

- [Asset record/content intended behavior](https://github.com/Comfy-Org/ideation-sharing/blob/87f638f1a6a424f151666d78f99eda45e7ad623f/asset-record-content-split/desired-behaviour.md)
- [Asset record/content logical architecture](https://github.com/Comfy-Org/ideation-sharing/blob/87f638f1a6a424f151666d78f99eda45e7ad623f/asset-record-content-split/architecture/logical.md)
- [Asset record deletion scenario](https://github.com/Comfy-Org/ideation-sharing/blob/87f638f1a6a424f151666d78f99eda45e7ad623f/asset-record-content-split/architecture/scenarios.md#delete-a-record-through-the-api)
- [Current frontend output deletion path](../../src/platform/assets/composables/useMediaAssetActions.ts)
- [Current history-derived asset store](../../src/stores/assetsStore.ts)
- Assets PR meta-review meeting, 2026-08-27 (Christian, Simon, Austin, Alex):
  settled output Delete as record deletion, deregister-only, unwind on partial
  batch failure, no disk-deletion claims in success copy
