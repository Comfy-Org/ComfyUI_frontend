# Agency partnership WIP handoff for June

Design and copy are unfinished. Continue from the seven Vue/Astro/type files in the parent directory. No public page route, PR, merge or website deployment is included. Preserve the nonroutable boundary until release approval; `noindex` is not access control.

## Run the handoff preview

From this folder, run `node preview.mts` using Node 22.18+ or newer with native TypeScript support. Open `http://127.0.0.1:8842/`. Stop with Ctrl+C. No dependency installation or build is needed. The server binds only to localhost, serves in-memory HTML, and fetches the approved public media URLs in the browser.

This preview renders the overview and six profiles with specialty labels, hosted logos/media, centered selected work and About after the gallery. Native Foreign intentionally shows a missing-work placeholder. It is a structural preview to continue the WIP, not a final design or the original pixel-accurate Vue/CSS capture. It does not reproduce the production Comfy navigation/footer. The real components remain the source of truth for integration.

## Included data and media

`agency-review-data.json` contains six agency records, labels, public contact destinations, 67 work records and hosted asset URLs. No private Air/Notion URLs, signed URLs, credentials, machine-specific paths or media binaries are included. Every `sourceUrl` now points to the corresponding public hosted media file, not the original source system.

| Agency | Unique work items |
| --- | --- |
| Asteria | 4 videos |
| Black Math | 21 videos, 3 animations rendered as video, 15 images |
| Brick Visual | 1 video |
| Contender | 11 videos |
| Native Foreign | 0; work pending |
| Silverside | 12 videos |

Existing derivatives and six selected logos were copied without reprocessing originals. Duplicate Asteria originals and alternate logos are intentionally omitted from work galleries. Original source files remain separately preserved. No large binaries belong in this branch.

Media destination: `gs://comfy-org-videos/website/agency-partnership/wip-2026-10-20/`, project `dreamboothy` (Comfy Org Prod). Public delivery root: `https://media.comfy.org/website/agency-partnership/wip-2026-10-20/`. This prefix was empty before upload; no-clobber copying protects existing objects. `media-all/` contains derivatives/posters and `logos/` contains the six selected logos. Assets are public, explicitly approved by the user; uploading assets does not publish or approve agency webpages. No bucket, IAM or organization-policy changes were made.

## Historical implementation reference

`preview-harness-reference.md` preserves sanitized historical scripts used for the actual Vue SSR/CSS review with production HeaderMain/SiteFooter. It is reference material, not a validated portable builder. Substitute its placeholders and use the current JSON rather than its older machine-specific data assembly. It expects installed Vue/esbuild/Tailwind dependencies, logos, media provenance and shell bundles/source collection. No media processing needs to be rerun. The dependency-free preview above is the immediately runnable handoff.

For full website integration, supply the JSON records and labels to `AgencyPartnershipReview.astro` or the Vue components, preserving the logo mask settings for Brick Visual and Contender. The actual templates reuse HeroCentered01, SectionHeader, Card, Button, Badge and SiteVideo. Keep previews local or behind genuine access controls until page publication is approved. Localization and final route wiring remain open.

## Verification and remaining work

Earlier live Chrome checks at 1440×900 and 390×844 confirmed six logo identities, specialty badges, correct gallery counts, centered Selected work, centered About below gallery, overview links and production navigation/footer presence. Mobile menu opened and Escape dismissed it. Prior saved review reports cover gallery playback; it was not rerun for this handoff. The remaining full footer interaction check was interrupted by the task-managed local server stopping between turns. No full production Astro integration or current dependency typecheck/lint is claimed.

Some work headings retain raw filenames. Final design, copy, localization, responsive production integration, Native Foreign work supply and release clearances remain for June/campaign owner. Prior review notes flag Brick reel attribution, Native Baywatch embargo, Black Math sign-off and Silverside claims clearance; reconfirm those before publishing pages. Do not treat this handoff as release approval.

Google Cloud browser reauthentication completed and token retrieval succeeded without displaying tokens. The standard default configuration persists between tasks; no temporary configuration override was set. The generic earlier reauth failure does not prove whether organization session limits or invalidated refresh credentials caused it. If daily sign-in recurs, the Workspace administrator can confirm Cloud session length. No security settings were changed.

## Main announcement hero update

The overview only now includes `comfy-agency-partners-hero-34s-v019.mp4` as the announcement placeholder, with native playback controls and no autoplay. `overviewHero.src` in the data points to the exact uploaded MP4. `AgencyOverviewDraft` defaults to that hosted video and accepts an optional `heroVideoSrc` override; `AgencyPartnershipReview` forwards it for overview mode only. The portable preview displays it above the agency directory. Individual agency components and their galleries are unchanged. The source video is preserved without re-encoding.
