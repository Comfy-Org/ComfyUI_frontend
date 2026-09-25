# Original demo parity review

September 24, 2026. Compared the original `cinema-studio-starter` source with
this migration. This is a workflow/source review with mocked browser checks,
not a live Router quality or latency certification.

## Covered workflows

| Workflow                    | Current implementation / verification boundary                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image/video creation        | Separate persisted drafts, model-specific controls, review before submission; mocked browser checks cover both layouts. Live generation remains deferred.                                                                                                              |
| Camera and visual direction | Camera/lens/aperture choices, genre/era illustrations, tempo, ordered movements, palette and lighting controls. Uses Rob's component layout rather than recreating the original equipment carousel.                                                                    |
| Palette and lighting        | Custom swatches, color reference sampling, main color, harmonies, light settings, Apply/Cancel and saved creative presets are implemented. These guide the prompt; exact output matching is not guaranteed.                                                            |
| References and elements     | Uploaded/saved references, named characters/locations/props, crop, ordered submitted references and scoped restoration.                                                                                                                                                |
| Editing                     | Camera/look/relighting, frame/anchored/portrait guidance, exact input review. Provider contract restrictions remain visible.                                                                                                                                           |
| Plans and prompts           | Multiple named plans, captured settings and reference subsets, saved takes, reviewed enhancement and request recovery.                                                                                                                                                 |
| Saved creations             | Local scoped storage, search, favorites, rename, download, recipe import/export and reuse.                                                                                                                                                                             |
| Continuity and transitions  | Submitted-reference checklist, next-shot reuse, starting/ending frame setup, boundary thumbnails and restoring the reference bundle. The library carries result review rather than a separate original-style transition result screen.                                 |
| Comparison                  | Image/video preview and saved settings; this round adds Reuse settings and Animate directly on each result in both layouts. Animation needs available, revealed image media; reuse retains the existing edit-operation restriction. Neither action submits generation. |
| Models                      | Bundled catalog visibility plus supported Studio routes; capability details and local observed timing are implemented. Catalog visibility is not universal Studio execution support.                                                                                   |

Camera/edit variation follow-up: the editor now offers 1–4 sequential requests,
with an explicit separate-charge notice in both setup and final review. Supported
Seedream and Qwen routes expose contract-bounded seeds; Gemini hides seed. Zero
is preserved in requests and recipes. Fixed seeds are reused across variations
and may produce similar results. Failure/cancellation stops remaining requests.

Lighting diagram follow-up: the creative draft now displays numbered, colored
light markers around the subject/camera, with a separate height view for Above
and Below. Markers sharing a position remain separately visible. Accessible
descriptions include position, color, brightness and diffusion. This visualizes
prompt guidance, not a physical lighting simulation; Apply/Cancel are unchanged.

Preset follow-up: palettes and lighting now have independent browser/workspace
scoped stores. Palette loads only colors/main priority; lighting loads only
light positions/colors/brightness/diffusion. Loads update the draft until Apply.
Existing combined presets remain under an explicit expandable section and keep
their original storage key and full-settings behavior. Each separate store keeps
up to 16 named entries, with same-name replacement within that preset type only.

Comparison follow-up: chosen pairs persist as two IDs in scoped browser storage.
An asynchronously loading library does not overwrite that choice. Missing or
deleted selections fall back to distinct available items. The comparison table
marks differences in saved values, including prompts, camera/look, creative
guidance and zero/false values; absent settings are explicitly unrecorded.
Original media opens in a separate tab and can be downloaded after any required
reveal. These controls do not measure visual similarity.

Model output follow-up: Your creations now groups Studio scenes and Model & tool
results in the same dialog. New successful native model-page runs automatically
save their output files to browser storage scoped to the submitting account and
workspace. Save status and a storage-only retry are visible on the model page;
the library link opens the corresponding section. Image/video/audio previews,
downloads for all output types, search/type filters and confirmed deletion are
available. Revealed images can be edited or animated in Studio. Raw response
metadata and form inputs are not archived, and past unsaved runs cannot be
recovered. Model records do not pretend to have Studio recipes or scene settings.

Equipment follow-up: the camera picker now has original illustrated previews,
previous/next browsing, direct choices, selected-state markers and keyboard
navigation for camera body, lens, focal length and aperture. All current catalog
choices are retained. Mobile shows one tab at a time; desktop shows the four
groups together. Selection continues through the existing prompt/review/draft
path, with no separate generation or physical hardware simulation.

## Remaining differences

These are explicit follow-ups, not claims that the migration is a complete replica.

- Visual presentation and available equipment names follow Rob's Studio
  foundation; this is not a pixel-for-pixel recreation of the standalone demo.

## Delivery boundary

The shared `/models` authentication, credit gates, contracts, uploads and Router
execution remain the integration path. Local drafts and creations are browser
storage, not cloud synchronization. No private original media, API key backend,
admin routes or paid test calls were copied into this migration.

Successful authenticated image/edit/video checks remain pending until live
verification resumes. See MIGRATION.md for test results and runtime limitations.
