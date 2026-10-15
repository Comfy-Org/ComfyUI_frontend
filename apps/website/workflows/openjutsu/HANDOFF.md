# Openjutsu handoff

Written 2026-10-12 for whoever takes Openjutsu from Rob to `main`. The app
works and the design is settled. What is left is review, a secret, and merges.
`README.md` beside this file is the workflow contract; `BENCHMARK.md` holds the
measured costs.

## Where everything is

| Thing      | Where                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| The app    | `rob/app-openjutsu`: engine, Mar's redesign (PR #20636, merged in), `main` as of 2026-10-13, app proxy ids |
| Backend    | Comfy-Org/cloud#13014 (draft, checks green), ticket BE-20545, branch `rob/app-proxy-openjutsu`             |
| Deployment | `dep-4a66f1a2-f688-4169-8f30-8ddc1ce78b51`, Workshop Apps workspace, 0 to 1 workers, ready                 |
| Flag       | `workshop-openjutsu-app-enabled` in PostHog: `comfy_staff` at 100%, nobody else                            |
| Build spec | Outside the repo, on Rob's machine: `~/comfyvibe/projects/comfy_workshop/openjutsu/build-workshop-apps/`   |

`rob/openjutsu-handoff` is an earlier snapshot and can be deleted.

## What is left, in order

1. **Create the secret.** `COMFY_API_APP_PROXY_KEY_WORKSHOP_APPS` in GSM for
   prod, stg-v2 and test-v2, holding a Workshop Apps `comfyui-` key. A declared
   secret with no value stops comfy-api starting, so cloud#13014 must not merge
   first. Move anything will share this secret.
2. **Decide on non-prod calling prod.** `stg-v2/openjutsu` and
   `test-v2/openjutsu` are in `prodTargetsFromNonProd` marked
   `DECISION PENDING`. Same shape as BE-17672.
3. **Merge cloud#13014**, then run `/add-rates app-proxy`. Set `starting_at` in
   `rates.json` and `products.yaml` to the apply day; both say 2026-10-12 now.
4. **Browser test with a faked app proxy**: done, `e2e/openjutsu.spec.ts` with
   `e2e/fixtures/openjutsuProxy.ts`.
5. **Run one swap through the staging app proxy** with a signed-in account and
   check the quote, the charge and a refusal. Nothing but the local proxy has
   been exercised so far.
6. **Open the PR to `main`**, behind the flag. A ticket and a design doc are
   drafted; ask Rob for them.

## Worth a second look in review

- The merge of `main` conflicted in the two locale files, the site header and
  the site footer. The locale files were merged key by key from the common
  ancestor (no key lost on either side). The header keeps Mar's
  `WorkshopAccount` with `main`'s `hub-sections` prop; the footer keeps her
  `in-data-workshop-editor:hidden` class without the `ref` that `main` removed.
- A run refused for credits is worded for an owner or a member by asking the
  shared `studioGate` about an empty balance (`emptyBalanceGate` in
  `swap-rules.ts`), so the role rule stays in one place. Under
  ADR-API-SERVER-FACTS-0042 the backend should emit that fact; Re-shoot has the
  same derivation.

## Decisions Rob has made

- 25 credits per second of output at one rate; no free runs for now. A 5 s swap
  is 130 credits, the longest (345 frames, 14.4 s) is 360.
- Both qualities stay available, 768p by default. 768p costs about twice what
  480p does to run, so the app stays staff-only until the catalog can tier by
  resolution or the rate changes.
- Parts up to 14.4 s stay allowed, though quality fell off at 10 s and 14 s in
  testing and those runs cost more per second than the rate.
- Core nodes only. No custom node is to be added for pricing.

## How the price works

The app proxy prices the run from the node that sets what is generated
(cloud#13014): `MiniMaxH3ReferenceToVideo.length` (node `136`), the frames
generated, at 25/24 credits a frame, tiered by that node's `width × height`.
The quote reports it as `tier_input: megapixels`, `tier_match: at_most`: the
rate is the smallest tier at or above the canvas area (480p canvases up to
0.45 MP, 768p up to 1.1 MP), and a larger canvas is refused. 5 s generates 124
frames, so 130 credits; 14.375 s and up is 345 frames, 360 credits. Both tiers
use the same rate for now; a lower 480p rate is a catalog change only.

`136.length` must stay a literal set by `workflow.ts` (`gridFrames`), and
`price.ts` prices the same frames on the same canvas (`swapCanvas`); a test
ties the two. If the page cannot read a quote's price, Generate stays off and
the page says the price is unknown, so the catalog can never charge an unseen
price.

## Still open

- The MiniMax H3 Community License excludes the US, EU, UK and South Korea
  from its standard grant. It needs a decision before anything public.
- A run refused because the deployment is stopped shows "Something went wrong.
  Try again."; it should say the app is unavailable.
- The benchmark has one or two runs per setting, not the three per tier the
  handoff to billing asks for.
