# Openjutsu handoff

Written 2026-10-12 for whoever takes Openjutsu from Rob to `main`. The app
works and the design is settled. What is left is review, a secret, and merges.
`README.md` beside this file is the workflow contract; `BENCHMARK.md` holds the
measured costs.

## Where everything is

| Thing            | Where                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Engine and tests | `rob/app-openjutsu`                                                                                      |
| Redesign         | `mariana/openjutsu-fullscreen`, PR #20636 against `rob/app-openjutsu`                                    |
| Both combined    | `rob/openjutsu-handoff` (this branch): Mar's branch, plus the app proxy ids and the price on the page    |
| Backend          | Comfy-Org/cloud#13014 (draft), branch `rob/app-proxy-openjutsu`                                          |
| Deployment       | `dep-4a66f1a2-f688-4169-8f30-8ddc1ce78b51`, Workshop Apps workspace, 0 to 1 workers, ready               |
| Flag             | `workshop-openjutsu-app-enabled` in PostHog: `comfy_staff` at 100%, nobody else                          |
| Build spec       | Outside the repo, on Rob's machine: `~/comfyvibe/projects/comfy_workshop/openjutsu/build-workshop-apps/` |

This branch repeats three commits that are already on the other two branches
(the display ordering, the final-cut fix, the character tile), and carries two
reverts of interface changes Rob tried and dropped. They merge cleanly; squash
or rebuild the branch if the history matters.

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
4. **Merge #20636 into `rob/app-openjutsu`**, then merge `main`. The merge of
   `main` conflicts only in the two locale files: `main` added a `changelog`
   section where `openjutsu` sits, and both are kept. The merge commit is then
   stopped by the pre-commit `lint:server-facts --staged` step, which flags
   `main`'s own workspace and billing files because a merge stages them. That
   is unresolved.
5. **Take the last two commits of this branch** onto the result: the app proxy
   ids in `src/config/workshop-env.ts` and `src/lib/workshop/openjutsu/price.ts`.
6. **Add a browser test with a faked app proxy**, as
   `e2e/fixtures/reshootProxy.ts` does for Re-shoot. Not started.
7. **Run one swap through the staging app proxy** with a signed-in account and
   check the quote, the charge and a refusal. Nothing but the local proxy has
   been exercised so far.
8. **Open the PR to `main`**, behind the flag. A ticket and a design doc are
   drafted; ask Rob for them.

## Decisions Rob has made

- 25 credits per second of output at one rate; no free runs for now. A 5 s swap
  is 125 credits, the longest (345 frames, 14.4 s) is 360.
- Both qualities stay available, 768p by default. 768p costs about twice what
  480p does to run, so the app stays staff-only until the catalog can tier by
  resolution or the rate changes.
- Parts up to 14.4 s stay allowed, though quality fell off at 10 s and 14 s in
  testing and those runs cost more per second than the rate.
- Core nodes only. No custom node is to be added for pricing.

## How the price works

The app proxy reads it from the submitted graph: `VideoFrameSample.num_frames`
is the part's frame count at 24 fps, and `seed`, always 0, is the only tier.
The rate is 25/24 a frame. `runQuote` in `price.ts` works out the same number
from the quote for the page. Tiering by resolution needs the catalog to derive
a tier from `width × height` on `MiniMaxH3ReferenceToVideo`, or to read
`seconds` and `tier` from two nodes; that was asked in cloud#13014.

## Still open

- The MiniMax H3 Community License excludes the US, EU, UK and South Korea
  from its standard grant. It needs a decision before anything public.
- A run refused because the deployment is stopped shows "Something went wrong.
  Try again."; it should say the app is unavailable.
- The benchmark has one or two runs per setting, not the three per tier the
  handoff to billing asks for.
