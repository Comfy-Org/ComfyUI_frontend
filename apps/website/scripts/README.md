# Website Scripts

## `router-provider-drift.ts`

Compares the checked-in Router provider coverage with the published schemas and
documentation. The command requires network access and is also run by the
scheduled Router Provider Drift workflow:

```sh
pnpm --filter @comfyorg/website check:router-provider-drift
```

## `generate-workshop-display.ts`

Imports the content team's `workshop-display.json`, keyed by catalogue model ID,
into `src/content/workshop-display.json`. From the repository root:

```sh
pnpm --filter @comfyorg/website generate:workshop-display /path/to/workshop-display.json
```

The committed output is a JSON array with one model per line. Keep its formatter
exclusion and generated-file attribute. Re-running the same import must produce
the same bytes. The importer validates catalogue IDs, content shape, and
example/output pairing before writing.

Content owns media, examples, editorial names, review flags, and its
`advancedFields` lists. Names copied unchanged from the catalogue are context,
not editorial overrides: importing them as overrides would hide newer canonical
Router names. Empty source `useCases` are classified from the catalogue.
Native Router identities, request schemas, input widgets, and request composers
are separate and must not be regenerated from a content drop.

### September 10, 2026 import

Source: `workshop-content-pack-2026-09-10.zip`, SHA-256
`914380ff6c273fc4afd829b4b9d57970d096a56ce7d1288cedc86aeac5d6e17a`.
The archive's handoff still quotes older coverage; the JSON contains:

- 268 entries, 261 thumbnails, and 150 paired examples/outputs across 127 models.
- 84 input-media references in 65 examples across 62 models, preserved in
  `examples[].values.medias` as ordered `{ role, value }` records.
- 696 content-side Advanced assignments across 210 models. These use the
  original catalogue's parameter names; the active native forms retain their own
  reviewed widget definitions and Advanced settings.
- No example seeds. Three models have fewer examples than the previous pack;
  the new arrays replace the old arrays together to preserve output pairing.

The later use-case expansion turns those 268 legacy source entries into 288
packed content/use-case records. The 268 figure is neither a model count nor the
final packed-record count.

Every delivered content value is retained, except duplicate catalogue context
and normalization of absent media/examples. Existing use-case classifications,
Router aliases/contracts, and the three editorial name overrides are preserved.

Follow-up: the native page adapter currently exposes output-only examples and
prefills prompt text only. Map and validate the other preset values and input
media against each canonical Router contract before enabling full example
prefill. A legacy `medias` array is not proof of native HTTP compatibility, and
an example's output must never be fabricated into its input upload.

Asset check on September 10: 369 distinct output/input URLs. Of 17 failures on
HEAD, 14 returned correctly typed media on a ranged GET. Three GETs still
returned jsDelivr's HTTP 403 "Package size exceeded the configured limit of
50 MB" response and need content hosting replacements:

- `bfl/flux-2-max`: input `input/fluffy_beige_sofa.png`.
- `ltx/image-to-video-v2`: output `output/api_ltx2_5_i2v.mp4`.
- `ltx/text-to-video-v2`: output `output/api_ltx2_5_t2v.mp4`.

All three are under
`https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@main/`. Their original
references remain in the import; do not substitute an unrelated model's media
or change MP4 URLs to an origin that serves them as `application/octet-stream`.

## `refresh-ashby-snapshot.ts`

Pulls the latest job postings from Ashby and writes
`src/data/ashby-roles.snapshot.json`. Invoked by the `Release: Website`
GitHub Actions workflow; also runnable locally via
`pnpm --filter @comfyorg/website ashby:refresh-snapshot`.

## `process-videos.sh`

Generates multi-resolution VP9/WebM + H.264/MP4 variants and a poster
frame for marketing videos using `ffmpeg`. Run **locally** before
uploading the outputs to `media.comfy.org`; this is not wired into CI.

```sh
apps/website/scripts/process-videos.sh \
  ./video-sources \
  ./dist/videos \
  "640 960 1280 1920"
```

### Output

For each source video at `./video-sources/foo.mp4`, you get:

```text
foo-640.webm   foo-640.mp4
foo-960.webm   foo-960.mp4
foo-1280.webm  foo-1280.mp4
foo-1920.webm  foo-1920.mp4
foo-poster.jpg
```

The naming convention is enforced by `buildVideoSources()` in
`src/utils/video.ts`, which the `<SiteVideo>` Vue component uses to
emit `<source>` URLs.

### Pairing with `<SiteVideo>`

Once the assets are uploaded, render them with:

```vue
<SiteVideo
  name="foo"
  base-url="https://media.comfy.org/website/marketing"
  :width="1280"
  :formats="['webm', 'mp4']"
  poster="https://media.comfy.org/website/marketing/foo-poster.jpg"
  autoplay
  loop
/>
```

### `<SiteVideo>` vs `<VideoPlayer>`

- **`SiteVideo`** — lightweight multi-source `<video>` for decorative or
  autoplay marketing clips. No custom controls, no captions UI.
- **`VideoPlayer`** — full-featured player with custom scrubber, mute,
  fullscreen, and caption toggles. Use this for content with subtitles or
  user-driven playback.

If you need both responsive sources and the rich `VideoPlayer` chrome, the
two are not yet combined; either pick one or extend `VideoPlayer` to accept
a source list.

### Encoder choices

- **VP9/WebM** at CRF 32 — preferred by Chrome and Firefox; smaller files.
- **H.264/MP4** at CRF 23, High profile, `+faststart` — universal fallback,
  required for Safari iOS.
- **Poster JPG** at q4 — extracted from t=1s when the clip is long enough,
  otherwise t=0; scaled to 1280w. Use this as the `poster` attribute so
  the video shows something while loading.

### Why a single resolution per video

`<source media="...">` inside `<video>` is unreliable across browsers
(Safari ignores it). The simplest correct strategy is to ship one
well-sized resolution and let CSS scale it down on smaller viewports.
The script generates multiple widths so you can pick a different one
per page (e.g. 1280w for a hero, 640w for a thumbnail), or wire up
JavaScript-based selection later if metrics demand it.

## `campaign-links.ts`

The **Website: Campaign Links** GitHub Actions workflow runs in the cloud on
manual dispatch. The destination table in `campaign-links.ts` defines the
supported destinations; run a preview to inspect the generated URLs.
Unbuilt Comfy advertising, film and animation, and architectural visualization
pages, retired Comfy VFX v1, and Black Math are excluded. A destination is not a
launch approval: verify the page and partner assets before publishing its draft.

Run a local preview from the repository root:

```sh
pnpm --filter @comfyorg/website campaign-links --mode preview
```

Choose a vertical, campaign track, page version, traffic source, creative and
optional audience in Actions. The script owns the defaults: all destinations,
LinkedIn (`linkedin`), and creative `sizzle_video_01`. The creative becomes
`utm_content`; the audience becomes `utm_term`. Campaigns use the existing
`comfy_` or `agency_` prefixes and medium `ads`. Confirm these values match the
actual ad and audience before creating drafts.

- **preview** produces a downloadable URL report without contacting the manager.
- **check** reads the manager and validates missing URLs without creating them.
- **create-drafts** validates all missing URLs before writing. Errors or newly
  detected duplicates hold creation and set `requiresReview: true`; warnings
  remain visible in the report and do not block creation. Held runs fail so that
  a green run cannot be mistaken for completed creation. Reports and artifacts
  are still attached when generation returns a held or partial result.

Creation sends one link per `/links-batch` request and continues past an
individual failure. Read-back verifies every missing URL; the report counts only
verified creations, lists unsaved URLs and their request failures, and fails the
run if anything remains unverified. A timeout can happen after a link was saved:
inspect the report and manager before rerunning, rather than changing the token
solely because a request timed out. If read-back itself fails, no verified
creation report is available; check the manager before rerunning.

Duplicate detection sorts full-URL query parameters. The manager hides
soft-deleted rows. A soft-deleted record, or one whose URL was edited while
retaining its old deterministic ID, can therefore collide during creation.
Earlier and later links may already be saved; restore or remove the conflicting
record in the manager before rerunning. Runs never edit or reactivate records,
publish Bitly links, launch ads, or change landing pages. The manager owns draft
status, timestamps, alias settings and creator attribution.

Authenticated `check` and `create-drafts` jobs use the `campaign-links` GitHub
Actions environment and run only from `main`. PR and preview jobs have no manager
credential. A repository administrator must complete this setup before use:

1. Create the `campaign-links` environment with a custom deployment branch rule
   allowing the **branch** `main` only (no tag rule). Required reviewers can be
   added if a human approval is wanted before authenticated runs.
2. Create a scoped API token in the manager's API Tokens page with `links:read`
   and `links:draft:create` only. Set its creator label to
   `Campaign Links automation`.
3. Add that token as the environment secret **`UTM_MANAGER_ENV_TOKEN`**. This
   deliberately differs from the old repository secret name, so an unconfigured
   environment cannot fall back to the repository credential.
4. Remove the old repository-level **`UTM_MANAGER_TOKEN`** secret and revoke its
   old manager token after the replacement is configured. GitHub cannot reveal
   encrypted secret values for an automated move. Do not copy a browser session
   or use the legacy shared token.
5. Merge this workflow onto `main`, run **check**, review its report, then run
   **create-drafts** when the missing links are correct. No schedule is enabled.

Authenticated runs share one concurrency group, so they never overlap. GitHub
replaces an older pending authenticated run when another is queued; check for a
cancelled run before assuming it created drafts. Previews are not serialized.

The [UTM Manager skill](https://utm-link-manager.pages.dev/skills/utm-link-manager/SKILL.md)
documents the API contract. This CLI intentionally uses only `node:` built-ins
and manual boundary validation, so the workflow can run with the repository's
`.nvmrc` without installing the website dependency tree. New runtime dependencies
such as Zod would require changing that no-install design. Unexpected errors
report their kind without leaking paths, provider responses or tokens. Campaign
names must match the ad platform or be mapped in PostHog for spend attribution.
