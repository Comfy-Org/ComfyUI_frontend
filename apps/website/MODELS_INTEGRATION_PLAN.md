# Models integration: merge preparation

Updated September 10, 2026.

`ben/models-integration` is the intended merge branch. It is separate from
the disposable #17263 preview (`ben/workshop-16556-content-preview`). It now
targets main, directly on Maanil's merged auth squash
`6f22e4bbbefb41f331aee90163933b9b0b82db74` (#17283). The account package and
website auth code in that squash match the former `957a240311` base. Only our
two integration/fix commits were replayed; no auth code was changed.

The older content-only #17227 overlaps this integration. Reconcile its scope
before merging either PR; it has not been closed or modified by this preparation.

## Included feature

- Mar's Models layout, with Rob's packed model/use-case content and distinct
  record IDs. Source content remains 288 records covering 268 original IDs.
- At frontend commit `0d965bab7b9`, using the Router source state identified
  below, the verified content/Router/schema intersection was 155 published
  use-case pages, 113 Router IDs and zero published Incomplete entries. These
  are historical measurements, not current-head counts. Unsupported source
  records were retained without a catalogue card or detail route.
- 207 pinned Router documents and 206 authored input contracts at cloud commit
  `9064b7d8748b2e5833be9a102f3ca36185137d86`. MiniMax H3 lacks authored input and
  is withheld. Full source and coverage evidence: `MODELS_ROUTER_COVERAGE.md`.
- Curated Standard/Advanced controls, defaults, validation, native request
  composition, URL/base64 uploads and matching code snippets.
- Real shared account/session integration and opt-in Router execution.
- Insufficient-credit errors link to the current backend family's real
  `/?settings=plan-credits` page in a new tab, preserving the form and uploads.
- Eric's media/defaults/layout fixes, including per-use-case creator variants,
  validated example inputs and distinct Seedance modes. See
  `MODELS_FEEDBACK_2026-09-10.md` for evidence and remaining editorial gaps.

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

## Latest focused verification

- 1,006 focused tests in 10 files for use-case contracts, example downloads,
  native request composition, identity joins, URL uploads, related cards and
  media controls. Full lint and root/account/website typechecks pass at commit.
- CI exposed stale assumptions in eight additional test files; their 788 tests
  now pass after updating them for use-case publication/media controls. The
  720-test contract file also passes under V8 coverage. No full local suite was
  run; exact-head CI remains the broader check.
- Enabled build: 1,999 HTML outputs including legacy routes. The published
  intersection now has 155 use-case pages; two incorrectly categorized entries
  are withheld without deleting source content.
- Installed Playwright on dev and built output: both hero videos decode frames;
  Grok's image/defaults and Veo's two frames load; Veo's API tab composes Base64;
  source uploads are visible on the checked image/video pages. Desktop and
  mobile have no page errors or horizontal overflow. Generation POSTs blocked.
- All 207 schema documents match the pinned backend files. Contract/index/alias
  regeneration is byte-identical; Rob's source content is unchanged by the
  schema refresh and auth-base sync.

The previous pass also verified auth/session/balance behavior and all use-case
route identities. Those historical checks are not a fresh paid-generation or
production-deployment claim.

This assembled feature exceeds the repository's usual small-PR size. Review it
in data/identity, controls/request composition, then UI/release-boundary order.
Those are also the natural split points if reviewers request smaller slices;
do not create another stack merely to move the same prototype debt around.
