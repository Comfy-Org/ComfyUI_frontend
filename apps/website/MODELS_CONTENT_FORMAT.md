# Models content: one model + use case per line

September 10, 2026. Local work on the combined preview branch
`ben/workshop-16556-content-preview` (#17263); this document is not a deployment
or merge confirmation.

## Identity and ownership

`src/content/workshop-display.json` is a packed JSON array: one complete record
per line, with opening/closing array lines. It is not strict JSONL. It remains
formatter-excluded and marked generated in `.gitattributes`.

Each record has one `useCase`. Its `id` and `slug` are equal and include both
the content model and use case, for example
`byteplus--seedream-4--edit-images`. The separate `modelId` is the original
content-pack identity, such as `byteplus/seedream-4`.

The reviewed alias file maps `modelId` to a real Router model. Multiple content
records may share one Router endpoint/schema. Content ID is never sent as the
Router model ID. Editorial display-name changes do not change identity.

The catalogue uses the intersection of reviewed content, verified Router IDs
and authored input schemas. Unmatched or missing-schema source content is
preserved in the packed file, not added to the UI.
Old model-only URLs redirect to a deterministic current record. Detail lookup,
sample ownership and saved drafts use the content slug, not only the Router ID.

## Media policy

A thumbnail or output sample URL may not be published in two different use
cases. The schema rejects that condition across the entire content file, not
only the currently visible catalogue. Sibling versions may share media within
the same use case, with the existing version ribbons.

The initial legacy import uses explicit assignments in
`src/data/workshop-content-use-cases.json`. Other cases get a neutral placeholder
until they have their own content. New multi-use-case sources require an
explicit assignment; the importer does not select a case by array order.

Where existing records shared a URL across different cases, media and its paired
example values were moved to `withheldContent`, not discarded or substituted.
That retained material is not rendered. `needsReview` flags these records.
Samples and examples retain their index pairing. A sample without settings is
allowed and remains a sample, not a fabricated prefill.

The guard checks exact URLs. Different URLs serving identical image/video bytes
still require editorial review; URL uniqueness is not visual-uniqueness proof.

## September 10 import snapshot

- Source: `workshop-content-pack-2026-09-10.zip` from Downloads, SHA-256
  `914380ff6c273fc4afd829b4b9d57970d096a56ce7d1288cedc86aeac5d6e17a`.
- The legacy source contains 268 entries across 127 catalogue models. Import
  expands those entries into 288 content/use-case records in 290 lines.
- At integration commit `30a137ded6f`, 157 records were visible and mapped to
  113 distinct Router models. These are historical publication measurements,
  not counts for the current branch head.
- 234 source records retain an active thumbnail; 31 visible records use placeholders.
- MiniMax H3's one record is withheld until Router authors its input schema.
- 29 records retain withheld content: 27 thumbnail occurrences and 18 paired
  sample/example occurrences. Nothing was deleted from the source archive.
- Source thumbnail/sample/example values were compared with the previous packed
  file across active plus withheld content; no missing or modified values.

The subsequent source-media repair adds verified input values to four previously
empty examples (Bria green screen/background replacement, Runway Aleph 2 and
FlashVSR). These are editorial updates to the packed file, not values present in
Rob's original archive. Workflow revision, filenames and checks are recorded in
`MODELS_FEEDBACK_2026-09-10.md`. Their durable override source is
`src/data/workshop-example-repairs.json`, pinned to workflow-template commit
`f331af10934fdf0d773d5f26c1d00f33559ae09d`. During both legacy and packed-array
imports, the generator applies an override only when the content ID, example
title and sample URL all match and the incoming values are empty. Different
samples and new editorial values are preserved.

The repaired September 10 packed file had SHA-256
`3e993cfe552a9e2b8b7b65515f32292c57b23513e47b631ed080a87983a093e9`.
That hash is historical verification of the reviewed output, not the durable
source of the repairs.

These are the September 10 import measurements, not permanent schema limits.

## Updating content

### Handoff to Rob

Edit `src/content/workshop-display.json`, not the generated Router contracts.
Keep each record's `id`, `slug`, `modelId` and `useCase` unchanged. Fill in its
`displayName`, thumbnail, samples and paired examples for that specific use case.
Use `needsReview` and `mediaConfidence` to record editorial review status.

Each `examples[i]` describes `media.samples[i]`: keep the order aligned. Use
different image/video/audio assets for different use cases, even when their
records map to the same Router model. Keep `withheldContent` as reference until
replacement material is reviewed; it is not published. Missing media uses the
neutral placeholder, never a borrowed asset from a different use-case row.

Return the updated array in the same one-object-per-line format. All 268 legacy
source entries across 127 catalogue models are retained in its 288 records. At
the `30a137ded6f` snapshot, 157 records with reviewed Router mappings and
authored inputs appeared in the catalogue. This content handoff does not claim
that per-case parameter overrides are implemented; see below.

### Importing an updated file

Run from the repository root:

```sh
pnpm --filter @comfyorg/website generate:workshop-display /absolute/path/to/workshop-display.json
```

The importer accepts the legacy model-keyed object and the new array format.
Legacy import expands models using the assignment file. New arrays preserve
individually edited records and reject duplicate IDs, inconsistent slugs and
cross-use-case media reuse. Keep the reviewed new array as the source of future
case-specific edits: reimporting a legacy pack is a wholesale regeneration, not
a merge of those edits.

Wire schemas remain separately packed in
`src/content/workshop-router-contracts.json` (206 records/208 lines), generated
from `src/data/workshop-router-openapi.snapshot.json` plus input curation.
Do not edit generated native contracts to repair content identity.

## Earlier content-import verification (before the schema refresh)

- 1,583 focused tests across 15 content, identity, contract, request and form
  files pass. The actual Wan form dropdown is exercised through request
  composition: selected resolution reaches `parameters.size`, with `n=1` and
  no output-count control.
- Website typecheck: zero errors/warnings, seven existing hints. Type-aware
  lint on changed source/tests and formatting pass.
- Both packed files regenerate byte-for-byte. The original Router OpenAPI
  snapshot is unchanged. Active plus withheld content preserves the previous
  packed file's thumbnails, samples and paired example values for all 268 models.
- These checks do not include a new build, browser rendering, paid generation,
  CI run, commit or push. The paused dev-key release test remains outstanding.

## Remaining work / recovery notes

- Per-case media, examples, names and prompt starters are isolated now.
  Per-case input lists, help/default overrides and mode restrictions are NOT yet
  wired: records sharing a Router ID still use its common creator definition.
  Add validated per-record overrides before claiming create/edit-specific
  parameter panels are complete. Preserve native whole-request validation.
- Content needs distinct artwork and task-appropriate examples for placeholders.
  Initial media assignments are not a completed editorial review.
- Only safe prompt starters are currently carried from legacy example values;
  other saved example parameters are retained but not blindly sent to Router.
- Live generation/render E2E is paused at Ben's request. Focused offline tests
  and typechecks continue; do not run paid requests as part of this pass.
- Preserve the separate uncommitted dev-key/E2E work. Its release-mode key-control
  test failed under inherited `NODE_ENV=development`; fix the actual dev-server
  boundary before pushing that slice. URL-upload live proof also awaits backend
  storage CORS configuration. Neither issue is solved by content reformatting.
- Keep content/use-case migration and input-policy changes as separate reviewable
  slices when committing. Do not bundle the paused dev-key work into them.
