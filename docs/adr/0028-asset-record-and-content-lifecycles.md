# 28. Asset Record and Content Lifecycles

Date: 2026-08-27

## Status

Accepted

This ADR records the asset-record/content model, the output deletion decision
made on 2026-08-27, and the remaining frontend gaps.

## Context

The Assets design separates a user-visible asset record from the content row
that describes bytes at a storage location. Multiple records may reference one
content row. An asset record owns labels and interpretation such as its name,
tags, metadata, optional preview relationship, and `job_id`; the content row
owns path, size, modification time, hash, and missing state.

For generated outputs, `job_id` records the prompt associated with that
record's creation event. It is informational provenance, not an ownership or
lifecycle foreign key. A record may retain a `job_id` after its prompt is no
longer present in transient history. `getJobAssets(jobId)` calls the paginated
`GET /api/jobs/{job_id}/assets`, but in-memory history remains the current
mechanism for showing a run's outputs during that session.

## Current implementation

With Assets enabled, the frontend lists input, output, and temp records from the
Asset API. With Assets disabled, it lists outputs reconstructed from `/history`.

Deletion follows the same flags. Without Assets, deleting an output or temp item
posts its `jobId` to `/history`. With Assets and asset deletion enabled, the
frontend calls `DELETE /api/assets/{id}` with asset-record IDs. For grouped
outputs, it uses the `assetId` values in `user_metadata.allOutputs`. With Assets
enabled but asset deletion disabled, the frontend rejects deletion.

Clear history still posts to `/history`. Product copy says generated assets
survive. They remain visible in the API-backed panel, but disappear from the
legacy history-backed panel.

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

6. **The output Delete action deregisters asset records.** It calls
   `DELETE /api/assets/{id}` with real asset-record IDs and does not delete files
   from disk.
7. **Batch deletion is non-atomic.** The frontend resolves every target
   asset-record ID before deletion. It does not roll back successful record
   deletions when another deletion fails. It deletes the owning job's history
   only after every record deletion succeeds.
8. **Success copy describes record deletion, not file deletion.** The server
   does not distinguish cases where it deleted nothing, so the copy must not
   imply that it removed files from disk.
9. **A feature flag selects deletion behavior.** Renaming the poorly named flag
   is separate cleanup.

## Implementation gaps

- **History cleanup:** With Assets enabled, deletion deregisters records but
  does not delete the owning job's history after every target succeeds. This
  does not yet implement decision 7.
- **Legacy deletion:** With Assets disabled, deleting an output or temp item
  still deletes history by job ID instead of deregistering asset records.
- **Identifier coverage:** Not every history-derived output has a real
  asset-record ID. The frontend must not send job-derived or synthetic IDs to
  the Asset API.
- **Backend behavior:** This repository does not establish whether history
  deletion cascades to asset records in each backend distribution. Any stronger
  lifecycle claim requires direct backend verification.

## Consequences

- Asset-record deletion code and tests can rely on record-only hard deletion;
  they must not infer deletion of content, files, sibling records, or history.
- A later scan may create a new record for content whose old record was deleted;
  the deleted record identity is not revived.
- In legacy mode, generated-output UI must not claim asset-record deletion while
  it sends a job ID to `/history`.
- Success copy for Asset API deletion must describe record deregistration, not
  file deletion.
- A future asset/job cascade requires its own evidence and decision; it is not
  an accepted invariant merely because `job_id` exists.

## References

- [Asset deletion intended behavior](https://github.com/Comfy-Org/ideation-sharing/blob/ab6246440c3234fe315e4fc36145c818e5309868/asset-deletion/intended/index.md) (private `Comfy-Org/ideation-sharing` repo — requires org access)
- [Asset deletion logical architecture](https://github.com/Comfy-Org/ideation-sharing/blob/ab6246440c3234fe315e4fc36145c818e5309868/asset-deletion/intended/logical.md) (private `Comfy-Org/ideation-sharing` repo — requires org access)
- [Asset deletion scenario: a user deletes a generation](https://github.com/Comfy-Org/ideation-sharing/blob/ab6246440c3234fe315e4fc36145c818e5309868/asset-deletion/intended/scenarios.md#a-user-deletes-a-generation) (private `Comfy-Org/ideation-sharing` repo — requires org access)
- [Current frontend output deletion path](../../src/platform/assets/composables/useMediaAssetActions.ts)
- [Current history-derived asset store](../../src/stores/assetsStore.ts)
- Assets PR meta-review meeting, 2026-08-27 (Christian, Simon, Austin, Alex):
  settled output Delete as record deletion with non-atomic batches, preserved
  history on partial failure, and no file-deletion claims in success copy
