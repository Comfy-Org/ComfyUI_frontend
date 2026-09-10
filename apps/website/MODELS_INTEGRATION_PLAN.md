# Models integration: merge preparation

Updated September 10, 2026.

`ben/models-integration` is the intended merge branch. It is separate from
the disposable #17263 preview (`ben/workshop-16556-content-preview`). It stacks
on Maanil's consolidated auth PR #17283, currently
`957a2403112291d666a8a1fa8ba4bc98b3d98f19`. No shared account-package behavior is
changed relative to that base. Retarget to main only after checking the auth
squash result and preserving this branch's own diff.

The older content-only #17227 overlaps this integration. Reconcile its scope
before merging either PR; it has not been closed or modified by this preparation.

## Included feature

- Mar's Models layout, with Rob's packed model/use-case content and distinct
  record IDs. Source content remains 288 records covering 268 original IDs.
- Verified content/Router/schema intersection: 157 published use-case pages,
  113 Router IDs, zero published Incomplete entries. Unsupported source records
  are retained in the content file but have no catalogue card or detail route.
- 207 pinned Router documents and 206 authored input contracts at cloud commit
  `9064b7d8748b2e5833be9a102f3ca36185137d86`. MiniMax H3 lacks authored input and
  is withheld. Full source and coverage evidence: `MODELS_ROUTER_COVERAGE.md`.
- Curated Standard/Advanced controls, defaults, validation, native request
  composition, URL/base64 uploads and matching code snippets.
- Real shared account/session integration and opt-in Router execution.
- Insufficient-credit errors link to the current backend family's real
  `/?settings=plan-credits` page in a new tab, preserving the form and uploads.

## Required before ready-for-review / merge

This is an intended integration PR, not a second throwaway PR. It starts as a
draft because the prototype must be made safe for ordinary deployments.

- [ ] Keep the existing public `/models` marketing page unchanged when
      `WORKSHOP_IN_BUILD` is off. The preview currently replaces it and moves
      the old page to `/models/showcase`; deleting all `/models` output would
      delete a pre-existing public route, not fix the release constraint.
- [ ] Gate the new Models routes, desktop/mobile navigation and English/Chinese
      homepage discovery section from the same compile-time decision. The
      current gate covers `/workshop`, not `/models`; the prototype's discovery
      section and navigation entries are unconditional.
- [ ] Verify both real build outputs, including sitemap/markdown twins, shared
      client bundles and existing-page comparison. HTML-only checks do not
      establish that unreleased content is absent from JavaScript. Shared
      translations and client imports remain part of this audit.
- [ ] Pin the agreed V1 layout for the merge branch; audit/remove unused
      prototype switches, alternate Hub workflow routes and mock-only paths.
      The visible mock-data panel is already absent, but the preview still
      carries alternative layouts selectable through its prototype state.
- [ ] Run focused browser regression checks on the prepared merge head, then
      the agreed broader CI/review gates. Do not treat historical preview
      checks or preserved screenshot baselines as current integration proof.
- [ ] Complete a funded end-to-end generation check when that paused work is
      resumed. Valid schemas and local auth do not prove every provider's live
      availability. No paid generation or purchase was made in this refresh.

Production website-origin CORS is a separate backend change, cloud #8885. It
has not been deployed by this work. The `workshop` PR label enables preview
Models/auth/Run but does not switch its default staging backend to production.

## Verification already completed on the matching preview code

- 1,286 focused schema/content/Router/auth/session/balance/component tests;
  10 header tests; 38 field/media/card tests; 119 shared session-core tests.
- Enabled build: 2,001 HTML outputs including legacy routes. All 157 intended
  use-case routes respond and match the packed record's Router ID and content.
- Installed Playwright: editable seeded prompts on Gemini Omni and Ideogram V3,
  normal controls, Ideogram aspect ratio and Advanced speed selection, empty
  optional seed, no Incomplete state, and missing MiniMax routes returning 404.
  External traffic is blocked; no generation requests are issued.
- All 207 schema documents match the pinned backend files. Contract/index/alias
  regeneration is byte-identical; Rob's source content is unchanged by the
  schema refresh and auth-base sync.

This assembled feature exceeds the repository's usual small-PR size. Review it
in data/identity, controls/request composition, then UI/release-boundary order.
Those are also the natural split points if reviewers request smaller slices;
do not create another stack merely to move the same prototype debt around.
