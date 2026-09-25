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

## Remaining differences

These are explicit follow-ups, not claims that the migration is a complete replica.

- Custom lighting: original `src/look-editor.js` includes a subject/camera/light
  positioning diagram. Current `CinematicCreativeEditor.vue` provides the light
  controls without that spatial illustration.
- Presets: the original saves palettes and lighting rigs separately. Current
  creative presets capture the combined draft; loading one changes those saved
  creative settings together.
- Comparison: original `src/review.js` persists its selected pair across reload,
  highlights changed settings in an A/B table, and offers original-size opening
  and download inline. Current selection is in-memory and settings appear per
  card; downloads remain available from Your creations.
- Output organization: native model-page outputs do not join the Studio library.
  The original's combined Scenes / Model & tool results organization is absent.
- Equipment presentation: the original illustrated camera/lens carousel is not
  reproduced. The corresponding choices use the current Studio controls.

## Delivery boundary

The shared `/models` authentication, credit gates, contracts, uploads and Router
execution remain the integration path. Local drafts and creations are browser
storage, not cloud synchronization. No private original media, API key backend,
admin routes or paid test calls were copied into this migration.

Successful authenticated image/edit/video checks remain pending until live
verification resumes. See MIGRATION.md for test results and runtime limitations.
