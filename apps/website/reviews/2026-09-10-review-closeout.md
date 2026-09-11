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
- No paid generation, real account sign-in or payment was performed. Browser
  authentication uses the real UI with mocked Firebase/session/balance services.
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
- The updated small pricing screenshot had captured a fallback font. All three
  CI actual images were byte-identical to the previous baseline, which is now
  restored. The other 16 updates retain the enabled header changes and existing
  pricing FAQ copy from `main`; the few remaining product-card pixels are
  rounded-edge antialiasing, not content changes.

Visual tests now load the real PP Formula Light file under a test-only family
with blocking display, await it explicitly, and apply it only to the existing
Formula/light combination. Production CSS is unchanged. A delayed-response
regression proves the face is applied; disabling its selector makes the test
fail. The integrated desktop run passes all 35 tests with no retries. A fresh
Linux run must confirm the full suite after these test-only corrections.

## Not claimed complete

- Real production-origin authentication/deployment: the Cloud prerequisites in
  the PR ledger still need production rollout and a real sign-in/balance check.
- The full Linux browser rerun after the two corrections above: the updater's
  earlier pass is not proof that the follow-up run is green.
- HTTP 301 alias responses (3984457892): Astro static output serves an immediate
  meta-refresh document with HTTP 200. The call site states this and a browser
  test verifies the canonical destination. Hosting-level permanent redirects
  remain a launch/deployment decision; this review does not change the site to SSR.
