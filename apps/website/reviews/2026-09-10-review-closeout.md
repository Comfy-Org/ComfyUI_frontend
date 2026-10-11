# Models review closeout — PR #17382

Reviewed base: `8966fa1b20a79558c138bf62d1b791e7c61e40b7`.
Review fixes: `7db24c32c1423bf728b0356b0bdb98b7881008ce`.
Updated against `main` at `dd1867baa6`: the only textual conflict was the
route table; both the incoming ChatGPT Images 2.5 route and Models routes remain.
The verification below covers the integrated code committed with this ledger,
not the agents' separate worktrees. CI and deployment must be checked on the
pushed head; local results do not imply approval or a production release.

## Decisions retained

- Keep one shared pricing evaluator for ComfyUI and Models. No website duplicate,
  CODEOWNERS edits, reviewer removals or review dismissals.
- Parent integrates substantive fixes; three Sol High worktrees supplied isolated
  tests, accessibility fixes and generator/documentation cleanup.
- Preserve the user's independent generation ledger/testing artifacts.
- The initial review tests used mocked Firebase/session/balance services and
  made no paid generation or payment requests. Later user-requested Krea and
  Recraft runs used the real signed-in TEST preview; their outcomes and deferred
  fixes are recorded below. No payment was performed.
- Human review threads remain for the reviewer. Verified automated threads can
  be resolved after the code and evidence are pushed.

## Functional fixes

- Upload selection waits for a session; editable prompts and curated remote
  examples survive sign-in. File/URL-upload round trips are tested.
- A member workspace with no credits can switch to its personal workspace;
  owner purchase behavior remains intact.
- BFL Fill/Expand use raw-Base64 media bindings for source image and optional mask.
- Dialogue supports ordered editable turns and enforces ten distinct voices.
- Ideogram's explicit structured variant sends `json_prompt`; text mode never
  infers JSON from punctuation.
- Extensionless source media is accepted only after response MIME/size checks.
- Creator options and generated models have complete schema boundaries.
- Exact-match media repairs survive reimport without overwriting newer content.
- Callback indexed fields keep numeric ordering; all published examples are tested.
- Pricing uses the active use case, respects separators, invalidates changed
  rules/defaults, and does not invent a missing combo default.
- Sensitive output and its Download action are absent until Reveal, with
  before/after assertions.
- Reduced-motion thumbnails stay still during SSR and pause on preference changes.
- Workflow/model joins use canonical content pages and exact tasks/versions.
  Seven explicit joins regenerate deterministically. Unsupported HappyHorse 1.0
  variants, generic ChatGPT and provider-only cross-version guesses stay unmapped;
  normal workflow destinations remain available. The HappyHorse R2V exception is
  local, so Seedance/Gemini reference-video behavior is not globally reclassified.

See the updated `2026-09-10-pr-17382.md` comment ledger for the smaller findings.
The agents' isolated reports remain local working notes; this ledger records
the integrated result that supersedes them.

## Integrated verification

All commands ran from the repository root under Node 26.8.2
(`fnm exec --using 26.8.2`).

| Check                                                                 | Result                                        |
| --------------------------------------------------------------------- | --------------------------------------------- |
| `pnpm --filter @comfyorg/website test:unit`                           | 302 files, 4,098 tests passed                 |
| Root Vitest: shared `nodePricing`, `piiUtil`, editor `useNodePricing` | 3 files, 105 tests passed                     |
| `pnpm typecheck`                                                      | Root and shared account passed                |
| `pnpm typecheck:website`                                              | 0 errors/warnings; 7 existing hints           |
| Shared-frontend-utils standalone typecheck                            | Passed, including corrected PII fixture types |
| `pnpm lint`                                                           | Passed; existing repository warnings remain   |
| `pnpm knip:no-cache`                                                  | Passed                                        |
| Models + homepage + header + visual-font Playwright specs             | 35 passed; widths 390, 1024 and 1440 covered  |
| JSON-LD / llms links / hreflang, enabled output                       | Passed                                        |
| Packed contract/index and template-join regeneration                  | Byte-identical; 206 contracts in 208 lines    |

The full unit run emits the existing happy-dom YouTube iframe teardown/network
messages; it exits successfully with no failed tests.

Browser command (uses the verified parent-owned preview on port 4325):

```sh
WEBSITE_E2E_PORT=4325 PLAYWRIGHT_HTML_OPEN=never \
  pnpm --filter @comfyorg/website test:e2e --project=desktop \
  e2e/homepage.spec.ts e2e/workshop.spec.ts e2e/header-models-navigation.spec.ts \
  e2e/visual-fonts.spec.ts \
  --workers=3 --retries=0 --trace=retain-on-failure --reporter=list
```

Build both shapes sequentially in the same worktree:

```sh
NODE_ENV=production WORKSHOP_IN_BUILD=1 PUBLIC_WORKSHOP_ROUTER_RUN=1 \
  PUBLIC_WORKSHOP_CLOUD_ENV=test WEBSITE_GITHUB_STARS_OVERRIDE=110000 \
  PUBLIC_CUSTOMERIO_WRITE_KEY=test-e2e-write-key \
  pnpm --filter @comfyorg/website build

NODE_ENV=production VERCEL_ENV=preview WORKSHOP_IN_BUILD=0 \
  PUBLIC_WORKSHOP_CLOUD_ENV=test WEBSITE_GITHUB_STARS_OVERRIDE=110000 \
  pnpm --filter @comfyorg/website build
```

| Actual output            | Enabled |                    Disabled |
| ------------------------ | ------: | --------------------------: |
| HTML files on disk       |   1,134 |                         749 |
| HTML under `models/`     |     386 | 1 (existing marketing page) |
| Retired `workshop/` tree |  Absent |                      Absent |

Disabled English/Chinese homepages have no new Models-detail hrefs. These are
route/link guarantees, not claims that shared translations or unused assets
are absent from JavaScript.

One failed browser attempt inherited `NODE_ENV=development` from the local
shell: Vite compiled out PostHog initialization and the auth flag never settled.
Rebuilding explicitly in production mode made the mocked sign-in flow pass.
Both browser-build workflows and the test README now state that requirement.

After updating from `main`, the full website unit suite, website/root/account
typechecks, both builds, 17 browser checks and output validators were rerun.
The incoming landing page accounts for the two additional HTML files; the
Models page counts are unchanged. All 75 prepared review replies are posted
with the fix commit as their evidence. Human review threads remain open.

## Post-push browser follow-up

The Linux screenshot updater (run `34562487482`) passed 66 tests and committed
17 baselines in `dee4fa6e01`. The subsequent full website run `34562667456`
reported 466 passing tests and two failures:

- The homepage carousel test still expected `/models/seedance-2/` instead of
  the canonical Seedance 2.5 use-case URL. The expectation now pins the canonical
  page. Review thread `3985991659` records this correction.
- The updated small pricing screenshot differed in font rendering. All three
  CI actual images were byte-identical to the previous baseline, which is now
  restored. The other 16 updates retain the enabled header changes and existing
  pricing FAQ copy from `main`; the few remaining product-card pixels are
  rounded-edge antialiasing, not content changes.

The first attempted repair loaded the real PP Formula Light file under a test-only family
with blocking display, await it explicitly, and apply it only to the existing
Formula/light combination. Production CSS was unchanged. A delayed-response
regression proves the face is applied; disabling its selector makes the test
fail. The integrated desktop run passed all 35 tests with no retries, but Linux
run `34563718277` subsequently failed 16 visual snapshots after that helper was
applied broadly. The earlier fallback-font classification was not established
by the pixel comparison. That visual-test issue was paused for the Run-button
regression below, then corrected in the follow-up below.

### Font override correction

The helper now waits for the page's existing `PP Formula` face and font readiness;
it injects no font family or selector. The delayed-font regression now also
checks that independently inherited text retains its width. With the old helper,
that assertion fails (90.109375 pixels instead of 80.078125); with the correction
it passes. All 35 Models/homepage/header/font browser tests pass without retries.
No production CSS or screenshot baseline changed in this correction. The full
Linux screenshot result must still be checked on the pushed head.

## Signed-in Models navigation regression

Reproduced on preview head `9ef6fffea6` with the user's real signed-in account:
top-menu Models → image card opened Krea with the label `Run`, but its button
still had the server-rendered `disabled` and `data-gate="pending"` attributes.
Reloading the exact same URL produced an enabled button with `data-gate="ready"`.
No generation was submitted.

The shared session is already ready during soft navigation. Initial client
hydration therefore chose a different conditional Button branch than SSR;
Vue repaired its text, but not the stale attributes. `ModelDetail` now keeps
the initial gate pending until `useMounted()` completes, then applies the
existing auth/session/credits decision. No account state or credit guard was
changed.

The existing browser sign-in test now follows the top-menu Models link and
opens Seedream 4.5. It failed on `toBeEnabled()` against the old build, then
passed against the fix. All 14 Models browser tests and 51 ModelDetail unit
tests pass. The enabled build passes, as do website typecheck (zero errors or
warnings, seven existing hints), changed-file lint and formatting. The unit
checks that inspect the gate immediately now await the mounted render tick.
Deployment and live navigation must still be checked on the pushed head.

The Run fix deployed as `79e14fece8` (Vercel run `34565149896`). Live menu →
Krea and menu → Seedream navigation both enabled Run with the real account.

A follow-up inspection found the same hydration mismatch on media uploads:
the hidden file input was enabled, but the visible label retained SSR
`pointer-events: none` and the group retained its disabled opacity. A real
trial click was blocked. The upload gate now also waits for the existing
`mounted` boundary. The browser regression clicks the visible label, waits
for the file chooser and selects a local image fixture; checking the hidden
input alone would miss this bug. It failed before this follow-up and passes
after it. All 62 ModelDetail/FileSourceInput unit tests and 14 Models browser
tests pass; no backend upload or generation is submitted by that regression.

## Deferred generation fixes

The user requested committing the current work before changing generation/output
behavior. Evidence is preserved without further paid runs:

- [Krea](2026-09-10-krea-generation.md): three variants plus one explicitly
  requested retry returned TEST Router HTTP 502 `provider_error`. The selected
  input schemas accept the captured bodies. Backend correlation is still needed.
- [Recraft](2026-09-10-recraft-generation.md): V4 Pro generated a verified WebP,
  but our extension-based classifier labels its extensionless URL as `.bin` and
  renders a file icon. The captured response supports an offline regression and
  shared output-classification fix next.

The reports link packed, sanitized attempt records. No claim is made about other
variants, full model coverage, or whether a failed attempt was charged.

## Not claimed complete

- Real production-origin authentication/deployment: the Cloud prerequisites in
  the PR ledger still need production rollout and a real sign-in/balance check.
- The full Linux browser run after the font override correction; the updater's
  earlier pass is not proof that the follow-up run is green.
- HTTP 301 alias responses (3984457892): Astro static output serves an immediate
  meta-refresh document with HTTP 200. The call site states this and a browser
  test verifies the canonical destination. Hosting-level permanent redirects
  remain a launch/deployment decision; this review does not change the site to SSR.
