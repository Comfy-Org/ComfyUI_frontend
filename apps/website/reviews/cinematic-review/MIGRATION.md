# Cinema Studio migration

Base: Comfy-Org/ComfyUI_frontend#18695. Review draft: #18751.

Studio uses the existing `/models` workspace authentication, Router contracts,
uploads, credit gates, queue and response handling. There is no standalone
API-key backend, copied private output library, or additional dependency.

## Implemented workflows

- Image/video composer drafts, frozen generation review, native playback,
  downloads, source-image edits, camera/look changes and prompt-based relight.
- Contract-supported video routes, durations, resolutions, audio and seeds;
  unsupported reference combinations are blocked before submission.
- Genre/era/tempo, ordered movements, custom palettes and lighting presets.
- Account/workspace-scoped local creations, favorites, rename, comparison,
  source lineage, downloads, validated recipe import/export and settings reuse.
- Named character/location/prop assets, pixel crop and ordered reference roles.
  Actual provider bodies retain every selected reference image.
- Guided scene building and editable plans with captured studio settings,
  per-shot reference selections, generated takes and previous-version labels.
- Editable prompt suggestions through the shared Router path, with review
  before the paid request and explicit application of the returned suggestion.
- Saved/uploaded transition boundaries, swapping, preview and exact-byte reuse.
- One to three separately reviewed motion clips, queued sequentially, stopping
  on failure or cancellation. An omitted seed allows independent provider seeds.
- Interrupted queued requests can be collected without submitting another paid
  generation. Unknown admission is never automatically retried. Completed
  receipts remain until the output is saved durably in the local library.
- Local reference bundles restore uploaded and saved media for settings reuse,
  plans and recovery. Missing media is reported; storage failures block new
  submission rather than quietly discarding references.

## Validation

- 284 focused unit/component/contract tests across 29 files passed.
- 12 production browser tests passed across both Studio layouts, including
  crop pixels, assets, edit review, prompt suggestions, plans, recipe import,
  motion comparison and transition reference restoration after reload.
- Website build, website typecheck, knip and Astro formatting passed.
- Desktop and mobile visual review uses feature-flag mocks and sample media.
- No paid generation or production workspace verification was performed.

## Limits and engineer verification

Storage is browser-local and scoped to account/workspace, not cloud sync.
Model coverage follows bundled authored contracts; it is not every Router model.
Dedicated Bria relighting is absent from those contracts; relighting here is
prompt-based image editing. Output-quality parity and identity lock are not
claimed. Existing feature gates remain in place.

Run supported-runtime CI and a live authenticated image/edit/video smoke test
before release. Local Node 24.19.0 is below the required 26.8.2. Earlier full-site
lint reports the unchanged pixal3d-trellis2.astro unused expression. The earlier
full website test run had 39 failed files, 24 failed tests, 8,240 passed and four
skipped; nine representative Windows shell/symlink failures reproduced on the
untouched base, while the remaining failures were not individually audited.
