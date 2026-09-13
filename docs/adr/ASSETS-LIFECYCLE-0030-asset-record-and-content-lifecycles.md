# ADR-ASSETS-LIFECYCLE-0030: Asset Record and Content Lifecycles

Date: 2026-08-27

## Status

Accepted

This ADR records the asset-record/content model, the output deletion decision
made on 2026-08-27, and the remaining frontend gaps.

## Context

The OSS core Assets model in the `asset-record-content-split` stack
([ComfyUI #15915](https://github.com/Comfy-Org/ComfyUI/pull/15915), with
[#15916](https://github.com/Comfy-Org/ComfyUI/pull/15916) through
[#15918](https://github.com/Comfy-Org/ComfyUI/pull/15918) carrying the tests)
separates a user-visible asset record from the content row that describes bytes
at a storage location. `Asset` is the record; `AssetContent` owns the bytes at a
path. Multiple records may reference one content row. An asset record owns
labels and interpretation such as its name, tags, metadata, optional preview
relationship, and `job_id`; the content row owns path, size, modification time,
hash, and missing state.

For generated outputs, `job_id` records the prompt associated with that
record's creation event. It is informational provenance, not an ownership or
lifecycle foreign key. A record may retain a `job_id` after its prompt is no
longer present in transient history. `getJobAssets(jobId)` calls the paginated
`GET /api/jobs/{job_id}/assets`, but in-memory history remains the current
mechanism for showing a run's outputs during that session.

## Current implementation

With Assets enabled, the frontend lists input, output, and temp records from the
Asset API. With Assets disabled, it lists outputs reconstructed from `/history`.

Deletion branches on `assetsEnabled` only. Without Assets, deleting an output
or temp item posts its `jobId` to `/history`. With Assets, the frontend calls
`DELETE /api/assets/{id}` with asset-record IDs regardless of the
`assetDeletionEnabled` flag. For grouped outputs, it uses the `assetId` values
in `user_metadata.allOutputs`. `assetDeletionEnabled` (see
`useFeatureFlags.ts`) only selects the confirmation copy: permanent deletion
when set, tombstone deletion when not, and history-only when no asset record is
planned. The frontend does not refuse to send the request when the flag is
unset; see "Implementation gaps".

Clear history still posts to `/history`. Product copy says generated assets
survive. They remain visible in the API-backed panel, but disappear from the
legacy history-backed panel.

## Decision

1. **Asset records and content have separate identities.** Multiple records may
   reference one content row, and records for cached reruns may carry different
   `job_id` values while sharing content.
2. **Deleting through the Asset API deletes one record.**
   `DELETE /api/assets/{id}` hard-deletes the target asset record, verified at
   [ComfyUI #15915](https://github.com/Comfy-Org/ComfyUI/pull/15915) commit
   `59cf36cb2c12f6a6ba3f53db0688246cb7a24f98`:
   [`delete_asset_route`](https://github.com/Comfy-Org/ComfyUI/blob/59cf36cb2c12f6a6ba3f53db0688246cb7a24f98/app/assets/api/routes.py)
   -> [`delete_asset_reference`](https://github.com/Comfy-Org/ComfyUI/blob/59cf36cb2c12f6a6ba3f53db0688246cb7a24f98/app/assets/services/asset_management.py)
   -> [`delete_record`](https://github.com/Comfy-Org/ComfyUI/blob/59cf36cb2c12f6a6ba3f53db0688246cb7a24f98/app/assets/database/queries/records.py)
   -> `session.delete`. It leaves the content row and file intact and never
   deletes another asset record. This supersedes the soft-delete model in the
   pinned intended design; see "Relationship to the pinned intended design"
   below.
3. **Preview references do not imply ownership.** Deleting a record that names
   a preview leaves the preview record intact. Deleting the preview record
   clears incoming preview references rather than deleting their records.
4. **`job_id` records provenance only.** It does not make history the lifecycle
   owner of an asset record or make an asset record the owner of history.
5. **History deletion has no asset-record cascade in this ADR.** The OSS
   `asset-record-content-split` design
   ([ComfyUI #15915](https://github.com/Comfy-Org/ComfyUI/pull/15915)) specifies
   no history-to-record cascade, and the current frontend copy says assets
   survive history deletion. The pinned Cloud intended design does cascade on
   generation delete; that cascade is Cloud-only (see "Relationship to the
   pinned intended design"). Whether OSS core should cascade, retain, or
   separately disclose records and bytes requires an explicit domain decision
   and backend evidence.

6. **The output Delete action deregisters asset records.** It calls
   `DELETE /api/assets/{id}` with real asset-record IDs and does not delete files
   from disk.
7. **Batch deletion is non-atomic.** The frontend resolves every target
   asset-record ID before deletion. It does not roll back successful record
   deletions when another deletion fails. It deletes the owning job's history
   only after every target record is confirmed absent. A target counts as absent
   when its `DELETE /api/assets/{id}` returned `204`, or returned `404` because
   the record was already gone (for example, deleted by an earlier partial
   batch). On any other failure the history is preserved and a retry re-runs the
   same gate; a retry must not delete history based on a previous batch's
   partial success.
8. **Success copy describes record deletion, not file deletion.** The server
   deletes only the record row and never removes bytes, so the copy must not
   imply that it removed files from disk.
9. **A feature flag selects deletion behavior.** Renaming the poorly named flag
   is separate cleanup.

## Implementation gaps

- **History cleanup:** With Assets enabled, the frontend never attempts
  history deletion, so it currently preserves history after both successful
  and failed asset deletions. It does not yet run the confirmed-absent gate
  from decision 7: it does not delete the owning job's history once every
  target has returned `204` or an already-gone `404`.
- **Asset deletion flag enforcement:** `assetDeletionEnabled` currently only
  selects the confirmation-dialog copy. The deletion path itself branches on
  `assetsEnabled` alone, so the flag does not yet gate deletion behavior as
  decision 9 intends.
- **Legacy deletion:** With Assets disabled, deleting an output or temp item
  still deletes history by job ID instead of deregistering asset records.
- **Identifier coverage:** Not every history-derived output has a real
  asset-record ID. The frontend must not send job-derived or synthetic IDs to
  the Asset API.
- **Backend behavior:** This repository does not establish whether history
  deletion cascades to asset records in each backend distribution. Any stronger
  lifecycle claim requires direct backend verification.

## Relationship to the pinned intended design

The ideation-sharing `asset-deletion/intended` documents at revision
`ab6246440c3234fe315e4fc36145c818e5309868` describe a single-row asset table
where `DELETE /api/assets/{id}` sets `deleted_at` and a reaper later removes rows
and bytes. That describes the Cloud/Postgres design. It does not describe OSS
core, where [ComfyUI #15915](https://github.com/Comfy-Org/ComfyUI/pull/15915)
introduced the `Asset`/`AssetContent` split and `DELETE /api/assets/{id}` is an
ORM hard delete of the record row.

For OSS core deletion semantics, this ADR supersedes that revision. The
references below are kept for the product intent (which the two models share:
deleting an asset never removes another asset, and never removes bytes another
record still references), not for the storage mechanics. Cloud's
generation-delete cascade in that design is Cloud-only and is consistent with
Decision 5: this ADR asserts no history-to-record cascade for OSS core.

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

- [ComfyUI #15915: asset-record-content-split (code)](https://github.com/Comfy-Org/ComfyUI/pull/15915),
  verified at head 59cf36cb2c12f6a6ba3f53db0688246cb7a24f98: `Asset`/`AssetContent` split, `delete_record` hard
  delete of one record row, no soft-delete column
- [Asset deletion intended behavior](https://github.com/Comfy-Org/ideation-sharing/blob/ab6246440c3234fe315e4fc36145c818e5309868/asset-deletion/intended/index.md) (private `Comfy-Org/ideation-sharing` repo — requires org access)
- [Asset deletion logical architecture](https://github.com/Comfy-Org/ideation-sharing/blob/ab6246440c3234fe315e4fc36145c818e5309868/asset-deletion/intended/logical.md) (private `Comfy-Org/ideation-sharing` repo — requires org access)
- [Asset deletion scenario: a user deletes a generation](https://github.com/Comfy-Org/ideation-sharing/blob/ab6246440c3234fe315e4fc36145c818e5309868/asset-deletion/intended/scenarios.md#a-user-deletes-a-generation) (private `Comfy-Org/ideation-sharing` repo — requires org access)
- [Current frontend output deletion path](../../src/platform/assets/composables/useMediaAssetActions.ts)
- [Current history-derived asset store](../../src/stores/assetsStore.ts)
- Assets PR meta-review meeting, 2026-08-27 (Christian, Simon, Austin, Alex):
  settled output Delete as record deletion with non-atomic batches, preserved
  history on partial failure, and no file-deletion claims in success copy
