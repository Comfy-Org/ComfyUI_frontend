# Models: local Router preview

Updated 2026-09-10. Work on disposable combined preview
`ben/workshop-16556-content-preview` (#17263). Do not merge this combined branch.
The requested preview deployment is tracked on the PR; this document does not
claim deployment success. The live API-key smoke check below returned 402.

## Auth base

The combined preview now builds on `maanil/auth-stack-combined` (#17283),
commit `957a2403112291d666a8a1fa8ba4bc98b3d98f19`, rather than the older
`throwaway/christian-closure-2026-09-09` snapshot. This is committed auth work,
not a claim that its PR is merged or review-approved. The account package is
unchanged from that base; Models uses its current `@comfyorg/account/session`
entry instead of restoring the removed core barrel.

The earlier September 10 rebase preserved the assembled prototype/content/Router
change as one preview commit. The previous head is retained locally at
`backup/17263-before-auth-combined-20260910`. Sixteen conflicting screenshot
baselines use the newer auth-base versions; this is not a screenshot update
or a claim that the combined design matches every upstream visual baseline.

Earlier rebase verification: 254 focused tests, website typecheck, uncached
Knip, both compile-flag build modes, three existing auth browser tests and
the catalogue/five-model desktop/mobile browser probe pass. Browser probes
made no generation requests. The disabled build still emits prototype
`/models/` pages; the inherited release-gating gap is not fixed by this rebase.
This combined preview must not be merged as a production release.

The subsequent auth-base sync uses ordinary merge commits, without rewriting
published preview history. It preserves Models discovery on the homepage and
keeps the incoming release section at the bottom. The shared account package
matches Maanil's latest base, including the module-local identity brand,
workspace-target checks and preference for a fresh live credential over storage.
Rob's packed content is unchanged by this sync.

Preview refresh against `f97c308495`: 524 focused auth, session, balance,
content/use-case and input-presentation tests pass. Website typecheck reports
zero errors/warnings and seven existing hints. The shared account package and
upstream identity test fixture match the auth base exactly. This is not a fresh
full-suite, browser-generation or deployment result.

While deploying the schema/credit update, the auth base advanced again to
`957a240311`. The preview follows it by an ordinary merge, including the
dependency-neutral session-contracts extraction and main's website-lint coverage.
Three CSS-only merge conflicts keep the preview's responsive navigation spacing
and main's equivalent typography formatting. No shared account code is modified
relative to that base. This sync does not merge either PR into main.
Its new website-wide lint coverage also required small prototype logging/type
cleanups, canonical Tailwind class formatting and Vue's input-update test helper;
no lint rules were disabled. After this sync, 1,286 focused website tests,
10 header tests, 38 field/media/card tests and 119 shared session-core tests pass.
The enabled build still produces 2,001 HTML outputs. None of these tests makes
a paid generation request.

## Schema refresh and insufficient-credit recovery

At frontend commit `30a137ded6f`, Router source was pinned to
`9064b7d8748b2e5833be9a102f3ca36185137d86`: 207 documents, 206 authored
inputs, 157 published use-case pages for 113 Router IDs, and no published
Incomplete entries. MiniMax H3 was withheld, not deleted from Rob's packed
content. These are historical measurements; later use-case review withheld two
more pages. See `MODELS_ROUTER_COVERAGE.md` for that later snapshot.

A Router `noCredits` result now offers **Buy credits**, not **Try again**.
It opens the real Cloud `/?settings=plan-credits` page in a new tab, retaining
the model form/uploads. It uses `WORKSHOP_CLOUD_BASE_URL` so staging stays with
staging and production stays with production. This does not use the old mock
Stripe dialog. The existing balance refresher retries on focus after returning.
The localized explanation no longer merely says payment happens on Stripe.

Focused verification: 1,261 tests across 13 schema, identity, creator, request,
Router, environment, balance and component files pass. This includes normal
controls and schema-valid request preparation for all eight newly authored
inputs, withholding every MiniMax URL, both CTA locales and the integrated
model error-to-credits-link path. Website typecheck has zero errors/warnings
and seven existing hints. No full-suite or paid-generation claim.

The enabled preview build passes (2,001 HTML outputs including legacy routes).
Installed Playwright checks against that build verified both Gemini Omni pages
and Ideogram V3: hydrated, editable seeded prompts; no JSON editor or Incomplete
state; Ideogram's aspect-ratio and Advanced speed selectors retain typed values,
and optional seed starts empty. Both missing MiniMax model/use-case URLs return
404, and the catalog has no link to them. External requests were blocked: the
four resulting footer-logo load errors are expected, with no other page errors
and zero generation requests. This is not a media-download or signed-in run test.

## Run locally

Use the repository's Node 26 runtime (at least 26.8.2). From `apps/website`:

```sh
WORKSHOP_IN_BUILD=1 PUBLIC_WORKSHOP_AUTH_FLAG=1 \
  PUBLIC_WORKSHOP_ROUTER_RUN=1 PUBLIC_WORKSHOP_CLOUD_ENV=prod \
  pnpm dev --host localhost --port 4321
```

The current local server on port 4321 is a dev server for this worktree, not an
old `dist` preview. Check `pnpm exec astro dev status` and the listening process's
working directory before testing; do not assume any server on that port is ours.

- [Models](http://localhost:4321/models/)
- [FLUX 2 Pro](http://localhost:4321/models/bfl--flux-2-pro/)
- [Krea 2 Large](http://localhost:4321/models/krea--krea-2-large/)
- [Native Gemini image](http://localhost:4321/models/vertexai--gemini-3-pro-image/)
- [Native ElevenLabs](http://localhost:4321/models/elevenlabs--eleven_v3/)
- [Ideogram V3](http://localhost:4321/models/ideogram--ideogram-v3/)
- [Local sign-in](http://localhost:4321/login/?returnTo=%2Fmodels%2Fbfl--flux-2-pro%2F)

The command above explicitly selects production Cloud, Router and Firebase so
local sign-in reads the existing production account's balance. Without that
override, the default family is staging Cloud, staging Router and development
Firebase: the same email there does not establish a production balance. Keep the
family consistent. Production Router requests can spend real credits; this auth
diagnostic authorizes sign-in and balance reads only, not generation or purchase.
The Run compile flag defaults off;
the Vercel preview workflow sets it alongside Models and auth only for PRs with
the `workshop` label. The production deploy job is unchanged. Local production
sign-in and balance are verified on the latest base as described below. This
does not prove paid generation or every model's live availability.

### Latest local auth check — September 10

All 309 shared-account tests and 141 focused website auth/session/balance tests
pass against this base. The telemetry fixture now imports its fake identity
after resetting modules, so it shares the session client's module-local brand;
the production guard and the behavior assertions are unchanged. Website
typechecking reports zero errors/warnings and seven existing hints.

The first local check used staging plus the forced-on auth flag and reported
zero credits despite a funded production account. That was not a production
balance test. On September 10 the local server was restarted with the explicit
production family; the served module confirms the `prod` override and production
Firebase, Cloud and Router. After a fresh sign-in, the real browser diagnostics
reported an authenticated session, the model gate reached `ready`, and two
successful balance reads from `https://cloud.comfy.org` returned the same funded
balance. Ben confirmed it works. No production auth or balance code change was
needed for this issue; the local environment selection was wrong for this test.
The balance/environment/header focused set passes 37 tests.

No controllable browser was connected in the verification session; Ben performed
the real sign-in, and the local dev server forwarded the diagnostic observations.
This is not an automated browser-suite or paid-generation result. The temporary
phase/balance logging was removed before publishing; no token or account
identifier was logged. The payment CTA fix described above is separate from
that balance diagnostic; broader pending/error-state lifecycle QA remains open.

The four `workshop-account.test.ts` failures at auth-base head `5cfd7b8765`
were fixed directly on #17283 in `248a308d00`. Its pre-reset fake identity had a
different module-local brand from the reloaded client. Both branches now carry
the test-fixture correction; it changes no production auth behavior. The latest
base also includes Maanil's flag-interruption and sign-up retry fixes. A
successful local sign-in does not certify that broader PR as merge-ready.

Read-only preflights from `http://localhost:4321` found:

- `https://stagingcloud.comfy.org/api/auth/token`: 204, exact localhost origin,
  explicit `Authorization` and `Content-Type` allowance.
- `https://stagingapi.comfy.org/customers`: 204 and exact localhost origin, but
  `Access-Control-Allow-Headers: *` only. The
  [Fetch standard](https://fetch.spec.whatwg.org/#cors-non-wildcard-request-header-name)
  requires explicit allowance of `Authorization`; the wildcard does not cover
  that header. This is a backend CORS issue for the bearer-authenticated customer
  provisioning step, not proof that Firebase or workspace minting failed.

Recheck the live response and actual browser behavior after a backend fix. An
already-restored session does not exercise new sign-in's provisioning request.
Do not bypass provisioning or change backend families to hide this failure.

Production website-origin CORS changes are proposed in
[cloud #8885](https://github.com/Comfy-Org/cloud/pull/8885): explicit ingest
origins for comfy.org, www and this preview, plus explicit Router preflight
methods/headers. This is not deployed yet. After rollout, rebuild the preview
with `PUBLIC_WORKSHOP_CLOUD_ENV=prod` before testing production sign-in there;
the `workshop` label alone does not select production backends.

The paused local API-key/E2E draft is preserved separately in stash
`4aa0ef4673cd237f2c388a1161c39b4c12f1a2d7`; it is not included in the auth sync
or the running local auth check. Restore it deliberately when that work resumes.

## Prior canonical-model coverage: verified intersection, not union

The counts and one-page-per-model policy below describe the earlier identity
audit. The later model/use-case split supersedes that page policy: 288 content
records now produce 157 visible pages mapped to 113 Router identities after
withholding the missing-input model. See
[MODELS_CONTENT_FORMAT.md](MODELS_CONTENT_FORMAT.md) for the current content
ownership, counts and remaining per-case parameter work.

Ben confirmed this policy on September 9: offer only native Router identities
with a verified, single-target join to Rob's content. One canonical model page
per Router ID; legacy task variants do not become duplicate model cards.

| Population                             |       Count | Treatment                                                           |
| -------------------------------------- | ----------: | ------------------------------------------------------------------- |
| Backend source identities              |         207 | Retained as schema data; not live-availability proof                |
| Authored input contracts               |         198 | Generic runtime supports all; visibility is a separate content join |
| Original catalog / Rob records         |         268 | Source preserved, all audited                                       |
| Verified single-target content joins   |         142 | 22 unchanged IDs, 120 repaired spellings                            |
| Distinct canonical Models              |         114 | Verified content / Router intersection                              |
| Canonical Models with input schemas    |         110 | Native form, Advanced, validation and opt-in execution              |
| Canonical Models missing input schemas |           4 | Incomplete; no invented form or enabled Run                         |
| Legacy task rows excluded              |         126 | 116 unavailable in snapshot, 4 ambiguous, 6 multi-target            |
| Router-only identities excluded        |          93 | No verified single-target Rob content join                          |
| Verified old URL redirects             |         120 | Redirect to canonical native model pages                            |
| Original Rob content                   | 268 records | 261 thumbnails, 106 presets, 113 output samples                     |

The old 453-page union was incorrect and is superseded. Rob's list matched the
partner-client model/task catalog we supplied, not the native Router inventory.
This is not 126 broken Rob records or proof those models cannot run elsewhere.
The audit checks the pinned backend source; it does not probe live deployment.

The four visible Incomplete models are:

- `gemini-interactions/gemini-omni-1.1-flash`
- `gemini-interactions/gemini-omni-flash-preview`
- `ideogram/ideogram-v3`
- `minimax/minimax-h3`

Nine input schemas are missing across the full source snapshot; only these four
belong to the current intersection. Incomplete Run is disabled before and after
sign-in, with a localized explanation and no copyable API request. A new authored
schema removes that marker on regeneration. A new Router-only identity also
needs a verified content join before it becomes a Models page. The initial nine
execution bindings remain presentation preferences, not an execution allowlist.

## Data and regeneration

`src/data/workshop-router-openapi.snapshot.json` contains all 207 complete
documents at backend commit `411500bd8c93a97328cf1a927b40ad5b24c60026`.
This includes Matt's merged cloud #8722; it is not proof of deployment.
Every referenced component and output content type is retained.

```sh
pnpm generate:workshop-router-snapshot <documents.json> <backend-commit>
pnpm generate:workshop-router-contracts
pnpm generate:workshop-router-aliases
```

Snapshot input is `[{id, document}]`. The second command reads the packed
snapshot and optional `src/data/workshop-router-bindings.json` presentation
overrides. It writes:

- `src/content/workshop-router-contracts.json`: 198 contracts, one per line.
- `src/content/workshop-router-index.json`: all 207 lightweight browse identities
  and explicit missing-input markers (209 lines).

Bindings are optional, not an enablement registry. The first nine retain
verified media-upload/status selectors and Advanced choices there.
Their synchronous-flow webhook exclusions and the FLUX 2 Pro Max-only setting
exclusion are enforced even in native-JSON mode.

`src/data/workshop-router-identity-audit.json` holds evidence and disposition
for every original ID, tied to the same backend commit. The alias generator
validates complete, unique coverage and rejects stale/unknown targets, then
writes `src/content/workshop-router-aliases.json`: 142 entries / 144 lines.
All generated JSON is packed one record per line, marked generated and excluded
from formatting. It is a valid JSON array, not strict JSONL.

Regeneration is deterministic and idempotent. The complete schemas are imported
only on the server-side detail projection, not through the shared browse
catalog. Each hydrated detail receives only its own execution contract/form.

### Editorial display names

The display schema now accepts optional `displayName`. The importer preserves
Rob's `_displayName` under that canonical field; an explicit `displayName` wins
if both are supplied. Cards, search labels and page titles prefer the override,
falling back to a canonical display-name override, then the catalog name. Router IDs, request bodies and URLs do not
change. Canonical packed entries also round-trip through the importer without
losing Advanced choices, classification, media, examples or review metadata.

Applied from Rob's naming note on September 9:

- `minimax/hailuo-03`: **MiniMax H3**.
- `minimax/hailuo-03-regeneration`: **MiniMax H3 Video Regeneration**, preserved
  in source but excluded from Models because no verified Router match exists.
- `vertexai/gemini-3-pro-image`: **Nano Banana Pro**.

The September 8 ZIP currently in Downloads still has the old names; these three
corrections come from the newer explicit note, not that ZIP. Reimporting an older
pack must not be mistaken for an updated content delivery. Rob can send naming
changes in the content pack or flag them; a UI-code PR is not required.

The September 9 creator pass additionally fills 22 canonical slug fallbacks in
`src/data/workshop-router-display-names.json`, including Seedance 2.0 Fast,
Seedance 2.5, Seedream 5.0 Pro, FLUX 3 Video, Veo 3.1 and Qwen Image 3.0.
All 114 visible models now have a nonempty display name distinct from their raw
Router slug; card/detail names agree. Rob's explicit overrides still win.

### Shared-thumbnail ribbons

`src/data/workshop-thumbnail-labels.json` holds short editorial labels keyed by
canonical Router ID, separate from Rob's generated content. The shared card
renders a diagonal upper-right ribbon only when two distinct models use the same
thumbnail URL and media kind. Labels are resolved against the full catalogue,
so filtering does not remove them; unique artwork and missing images stay plain.
The current data covers 56 models sharing 21 assets, including video thumbnails.
Labels are at most 12 characters and distinct within each shared-art group.
Ribbon text steps down from 16px (up to six characters), to 12px (seven to nine),
to 9px (ten to twelve), expressed in rem so browser text scaling still applies.
The ribbon uses a heavy sans-serif face (800 weight), rather than inheriting
PP Formula. The stripe is 40px thick, up from the initial 24px; its centre stays
in the same corner position. Its dimensions stay fixed across label lengths,
and labels are never truncated.
Full names, links, image/video sources and Router requests remain unchanged.
Verified with 27 focused card/catalogue/Hub/homepage tests, website Vue typecheck,
scoped type-aware lint and the enabled build. Browser checks cover six model
groups at 1440px plus 390px/320px layouts: labels remain on filtered cards,
text stays inside each thumbnail, video frames decode and no paid requests run.
Probe and screenshots: `temp/scripts/thumbnail-ribbon.JNFijc/` at repository root.

Catalogue search follow-up, observed during this check: `krea turbo` returns no
results while `Krea 2 Medium Turbo` matches. `filterWorkshopModels` still uses a
contiguous substring. Token-aware search is deferred, not changed by this UI pass.

## Forms, Advanced and request fidelity

Widgets use the allowlist in `src/data/workshop-input-presentation.json`:
model-specific definitions and well-known shared inputs. Required unknown
fields remain minimal controls; optional unknown fields do not appear.
Their declared defaults are preserved in `defaultInput` and request preparation.
The full native snapshot remains untouched. See `MODELS_INPUT_SCHEMA.md` for
Ben's GOOD/BAD definition and the current curation rules.

Across 198 contracts: 415 operational/unsupported field occurrences excluded
from requests, six optional fields without widgets, and no unmatched ordinary
required fields. All current declared defaults have explicit widget definitions;
implicit-default preservation remains covered for future unrecognized fields.
There are 540 Standard and 667 Advanced definitions (including media targets
represented by upload helpers). Closing Advanced
preserves values; errors reopen it. Numeric/boolean types, precision, bounds,
formats, nested JSON and references survive validation.

Labels are short; obvious common fields have no description. Specialist help
is curated, capped at 140 characters and shown inline without popups, never
copied from a Router documentation paragraph. Prompt fields start with Rob's
example text, a native example/default or predefined content. Saved edits and
intentional clears win. Required media/IDs are not fabricated. Defaulted
dropdowns initialize to the real default without an empty option. Duration uses
typed dropdowns where the supported finite values are known; continuous or
unbounded durations retain a numeric input. Seedance version restrictions are
data, not guessed in the component.

Curated pages no longer offer a Native JSON mode switch or raw JSON controls.
The September 9 creator pass replaces 151 JSON controls on 78 visible pages:
47 use structured-request adapters and 31 retain a simpler scalar mode without
unsupported optional JSON features. Template replacement is strictly typed and
contains no logic; named callbacks handle optional media and conditional shapes.
See `MODELS_INPUT_SCHEMA.md` for the source files, concrete mappings and limits.
The legacy uncurated path remains available internally. The existing four
missing-schema Incomplete entries and catalogue membership are unchanged.

Run and API snippets share request preparation. The complete native body is
validated again at the network boundary. Unknown ordinary form controls,
invalid JSON, invalid types, excessive files and oversized requests fail
before submission. Native JSON follows the schema's own additional-properties
policy and does not mix with ordinary-field values.

Image-file helpers on 22 visible models encode actual selected bytes,
never filenames or output-example URLs. URL-only widgets retain public URLs;
structured callbacks supply native nesting. They do not gain an invented upload
service merely because a schema says URI. Request JSON is capped at 10 MiB;
file preflight happens before reading bytes.

### API snippets and uploaded files

Run still sends the full native request, including actual Base64 uploads.
The API tab uses the same validated request composer with opaque, per-File
references instead of reading image bytes. Python and TypeScript turn those
references into local-file reads and Base64 encoding at script execution time;
native data-URL prefixes, MIME fields, array order and nested objects survive.
Set the generated relative paths to the input files on the machine running
the snippet. Same-named uploads get distinct suggested filenames.

cURL deliberately omits uploads and their image-only wrapper objects. It keeps
ordinary inputs and public URLs. Both the UI and copied command warn that the
request may be incomplete, especially on required-image models. Because the
body differs, cURL gets its own stable retry key; Python and TypeScript share
the full-request key. Editing inputs or selecting a replacement File rotates
the relevant keys without re-reading image bytes in the API tab.

The compact snippet change was checked with focused request/component tests,
including executing generated Python and TypeScript against real temporary
files with intercepted network calls, and executing cURL against a shell stub.
The local browser probe checks BFL, Seedance, Gemini, Veo and Tencent, including
raw Base64 and data-URL forms, prompts/settings preserved, and no paid requests.
Probe: `temp/scripts/models-snippet-files.pCUuLt/` at repository root.
This applies to `/models/`, not the inherited legacy `/workshop/models/` UI.

Rob's normalized presets are preserved in the source but **not applied to native
forms**. Identity reconciliation is not request translation. Joined samples are
explicitly output-only; viewing one preserves edited form and Native JSON drafts,
and the localized UI does not claim it fills in verified settings. Rob's original
drop contains no input-media URLs. Native forms use native contract metadata for
Advanced fields rather than old normalized names.

Merged task variants contribute verified use-case/modality tags to one native
card. Primary artwork is explicitly chosen where multiple sources join; task
prices are not transferred across repaired IDs. Old URLs redirect to the general
native model, not a guessed task preset. `heygen/starfish-tts` correctly joins
`heygen/starfish`, but its Rob media/examples depict Video Translate: that media
is quarantined from display, with the original source preserved for correction.

Some authored schemas are shared validation floors rather than complete
per-operation provider constraints. Passing a source schema is not proof every
accepted parameter combination succeeds in a live paid request.

## Execution and outputs

- Fresh workspace bearer from Maanil's shared session module; no credential
  duplication or token embedded in copyable snippets.
- Native `POST /v2/models/{provider}/{model}`; no /proxy fallback.
- Unchanged failed requests retain a literal idempotency key. Body/identity/
  workspace changes and deliberate new runs after success get a new key.
  No automatic paid retries; keys are memory-only.
- Cancel aborts the wait, not necessarily provider work/billing. Sign-out and
  workspace changes discard late results. Credits refresh afterward.
- JSON responses validate against an authored output schema where available.
  Known selectors remain data; the generic path extracts HTTPS assets and
  inline media and always retains a downloadable raw JSON response.
- Image/video/audio outputs use real media elements. Audio controls drive
  actual playback, seek and mute state. Binary audio does not need a JSON
  envelope. Multiple returned assets are selectable.
- 3D/unknown media are downloadable; there is no newly implemented interactive
  3D renderer. Unknown JSON response shapes remain inspectable rather than
  requiring a per-model response adapter.
- Inline media types come from the payload/MIME or byte signatures; an opaque
  URL without a recognizable type is downloadable rather than guessed.
- Raw text is escaped, display previews are bounded, and full responses remain
  downloadable. Response size is capped at 128 MiB; owned blob URLs are revoked.
- The 33 schemas permitting streaming accept event-stream responses. Events are
  retained as readable/downloadable text after completion, not displayed token
  by token. The same cancellation, timeout and response-size limits apply.
- Python/TypeScript snippets handle JSON and binary output. cURL saves the
  response to `output.bin`. All snippets use API-key environment placeholders.

## Verification

### Live API-key smoke check — September 9

One production request was authorized for testing, using `COMFY_KEY` only in
a local process, never in browser code, generated snippets or a committed file.
Production `GET /customers/balance` authenticated (200) and returned zero total,
effective, prepaid and cloud-credit balances. The live FLUX 2 Pro input schema
also authenticated (200) and matched the tested prompt/dimensions/seed fields.

A single `POST /v2/models/bfl/flux-2-pro` with a 512×512 text-to-image request
and a fixed retry key returned **402 / `insufficient_credits`** immediately.
Request ID: `0daf3149-f8ca-46bb-b7f2-f8b44952579b`. No generated image was
returned; there was no retry or credit purchase. Successful paid generation
remains unverified until the key's workspace is funded or a funded key is used.
The browser preview still uses staging, so changing its login is not a fix for
this production key's zero balance. The local diagnostic and private response
artifacts are under `temp/scripts/models-live-router.V3pB8M/` (ignored).

### Automated and browser checks

- Website suite: **3,302 passing tests across 258 files** after the provider-wide
  widget-definition audit. See `MODELS_INPUT_SCHEMA.md` for the model-specific
  corrections and remaining composed/nested-input work.
- All 198 contracts derive complete runtime forms; the 110 joined input-backed
  identities connect to native model pages. Visibility and runtime capability
  are tested separately.
- All **180 authored input examples**, projected to allowed inputs plus implicit
  defaults, round-trip through the form/request builder.
- All **161 JSON output examples** parse and retain output/raw response.
- New-schema fixture proves enablement without a provider binding.
- Explicit nulls, composed nullable references, native JSON persistence,
  invalid-input rejection, typed Advanced values, cancellation/idempotency,
  mixed media and binary/text response behavior have regression coverage.
- Generated Python/cURL/TypeScript payloads are parsed/executed with network
  stubbed. No paid traffic.
- Website typecheck: zero errors/warnings (five existing hints).
- Changed-file type-aware lint passes with the existing env.d.ts advisory.
  Website-scoped Knip passes.
- Enabled intersection build: **1,846 pages**, 1,430 markdown twins.
- Latest widget browser sweep: all 114 pages match their widget allowlists;
  all defaulted selects match their typed defaults with no empty option.
  Seedance duration/resolution defaults agree before and after hydration;
  Advanced edits work and mobile has no horizontal overflow. No page errors,
  Vue warnings or paid requests. Probe: `/tmp/models-input-widgets.Q4XIua/check.mts`.
- Browser sweep: all 114 canonical pages hydrated (110 native, four Incomplete),
  all 120 verified old URLs redirected, and all 219 excluded URLs returned 404
  (126 legacy + 93 Router-only). External traffic was blocked; no paid runs.
- Authenticated/unauthenticated incomplete gates and preservation of form/JSON
  drafts while viewing output-only samples are unit-tested.
- Desktop and mobile search, excluded-query empty state, canonical titles,
  disabled Incomplete Run and sample draft preservation pass in installed
  Playwright. Desktop/mobile screenshots were inspected; remote media was
  deliberately blocked, so this pass verifies layout/behavior, not CDN playback.
  Temporary reproducible probe: `/tmp/models-intersection-qa.7iWb38/check.mjs`.
- Earlier browser interactions verified Advanced edits survive collapse/reopen, native
  JSON produces the matching snippet, invalid JSON blocks copyable snippets,
  and Krea/Gemini/ElevenLabs native examples work through the same UI path.
- Full unit runs print pre-existing happy-dom/YouTube iframe teardown noise
  despite passing; those unrelated tests were not changed.

## Not a launch sign-off

Schema-backed local code coverage is not a claim that all models are deployed,
authorized for this account, or successfully generated paid results.
Remaining external/content work: missing input schemas, live backend
availability/CORS, bounded paid smoke tests, verified native preset values,
Rob's missing input media, Starfish media correction and any future identity
joins/content enrichment. Do not conflate source schema coverage with a paid
success rate.

The inherited /models release-exclusion/route collision and shared-bundle
issues are unchanged. Do not merge this disposable combined preview into
main or publish the unfiltered source catalog on the strength of local tests.
The inherited `/workshop/` tree still uses the old catalog and its own release
gate. Intersection/absence checks above apply specifically to `/models/`;
they do not claim old IDs are absent from every route or JavaScript bundle.
A production submission should split the schema/runtime and UI changes into
focused review slices; this disposable branch is the assembled local proof.

## Completed identity audit

Three requested Sol/High agents audited image/text (81 IDs), video (98), and
audio/3D/other media (89). Root integrated and independently cross-checked their
findings. The durable full record is `src/data/workshop-router-identity-audit.json`;
`MODELS_ROUTER_COVERAGE.md` summarizes dispositions and remaining work. Temporary
agent reports are under `/tmp/workshop-id-repair.JaIFEg/`, but the implementation
does not read that directory. Evidence names the partner capture, backend source
paths/selectors and the pinned commit; a matching marketing name alone is never
sufficient.
