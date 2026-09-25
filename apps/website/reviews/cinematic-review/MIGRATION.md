# Cinema Studio migration

Base: Comfy-Org/ComfyUI_frontend#18695. Review draft: #18751.

The existing `/models` workspace authentication, Router contracts, upload,
credit, queue and response handling remain the execution path. The standalone
demo server, API-key connection screen, private outputs and research scripts
are not part of this port.

## Verified before this milestone

- Image generation and review in both layouts.
- Seedance text-to-video and first/last-frame animation; image-to-video action.
- Separate image/video drafts and results; playback and downloads.
- 70 Studio tests, four production browser tests; desktop/mobile checks.

## Verified current milestone

- Account/workspace-scoped browser creation storage, names, favorites, export
  and generation settings reuse. Editing recipes require reopening the editor
  with a source image. Storage is local to the browser, not cloud sync.
- Source-image edits, camera viewpoint, look changes and prompt-based relight.
- Genre/era/tempo, ordered movement, custom palette/light drafts and presets.
- Guided scene builder and editable three-shot plans.

Validation: 123 Studio/storage tests and six production browser tests pass.
Browser checks cover both layouts, desktop/mobile, saved media after reload,
actual downloads, edit review/back and sample edit generation. No paid requests.

## Still to verify or migrate

- Model-specific seed/capability coverage and additional video routes.
- Recoverable interrupted request identity using shared Router collection.
- Named character/location assets, reference roles and crop.
- Planner generated takes, source lineage, saved plans and comparisons.
- Optional paid prompt suggestion with editable review.
- Complete recipe/reference restore, including explicit missing-media handling.
- Original workflow acceptance cases and live paid image/edit/video verification.
- Supported-runtime repository checks and engineer approval.

No claim of output-quality parity or deterministic relighting/identity lock.
Dedicated Bria relighting is not currently in the bundled model contracts;
prompt-based image editing must be described accurately.
