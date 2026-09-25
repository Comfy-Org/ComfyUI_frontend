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

- Latest run: 316 focused Studio tests passed across 33 component, library and
  composable files. Earlier route validation also passed two LTX Fast tests and
  731 shared contract tests; these were not rerun for the capability UI change.
- 21 production browser tests passed across both Studio layouts, including
  crop pixels, assets, edit review, prompt suggestions, plans, recipe import,
  motion comparison and transition reference restoration after reload.
- Website build, website typecheck, knip and Astro formatting passed.
- Desktop and mobile visual review uses feature-flag mocks and sample media.
- No paid generation or production workspace verification was performed.

See [PARITY.md](./PARITY.md) for the latest workflow comparison and explicit
remaining differences. Comparison now offers Reuse settings and Animate per
result, using the existing guarded actions without submitting a generation.

## Original demo parity follow-up

- All models opens an in-place searchable browser of the same 149 visible
  catalog entries as `/models`, with modality filters and explicit availability.
  Current-mode Studio models can be selected without losing the draft. Other
  entries open their native model page in a new tab. This uses the bundled catalog,
  not a live inventory of every model on the Router service, and does not add
  generation support for previously unsupported Studio models.
- The rendered picker now exposes 14 image choices and 19 video routes.
  Model-specific image framing and reference limits come from authored contracts.
  Native model controls remain available through the separate `/models` catalog.
- Expand Capabilities & generation time on any catalog entry for authored clip
  lengths, resolution, aspect, quality, audio and input controls where defined,
  plus Studio reference and frame limits. Missing capability definitions stay
  explicit; a list of settings is not a promise that every combination works.
- Generation timing is separate from clip duration. Successful uninterrupted
  foreground Studio requests record local account/workspace-scoped observations,
  including preparation/uploads/queue/result collection. Retain at most 20 per
  model across 60 models for 30 days. No prompts, media or credentials are stored.
  Demo, recovered, failed, cancelled, hidden/suspended and account-switched runs
  are excluded. Fewer than three observations are labeled insufficient to estimate;
  three or more show median, range and count. Settings may vary; this is neither
  a provider benchmark nor a promised completion time. Storage failures do not
  fail generation. No live latency measurement was performed for this change.
- Independent image/video drafts survive reload, including settings and stored
  reference bundles. Multiple named plans can be created, switched and restored.
- Camera editing supports source-frame guidance, source plus saved references,
  and portrait reconstruction. Review preserves the exact submitted image order;
  portrait reconstruction does not silently include the original scene frame.
- Completed results expose submitted reference thumbnails and a manual continuity
  checklist. Next shot restores the saved scene and selected output frame.
- Prompt suggestions retain editable results and recover admitted requests without
  submitting again. Genre/era visual examples and tempo diagrams supplement controls.
- `cinematic-film-directions.png` is the original prototype's generated illustration
  atlas, not a copied Higgsfield asset. Examples are illustrative and not references
  sent to generation. Existing Rob branch design tokens and layouts remain the base.

Kling 3.0 text-to-video now uses native Standard/Professional quality, 3–15 second
duration and audio settings. Kling O3 text-to-video uses its authored resolution
and duration controls. LTX 2.5 Fast has a distinct authored page bound to its own
existing Router contract, including portrait/landscape dimensions and audio;
Studio uses the native default 25 fps. All three currently expose text-only
generation, without claiming starting-frame support or live output verification.

This is not complete model or visual parity. LTX Pro remains disabled by the
shared catalog after provider invalid-input failures. MiniMax H3 lacks usable
authored execution inputs. Bria relighting has no bundled contract. GPT Image 2,
Flare and Sunburst reference editing remain explicitly disabled because the
Router routes reject edit media. Native catalog outputs
do not share Studio's local history, and the original camera carousel interaction
has not been recreated. Do not present these routes as live-verified Studio tools.

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
