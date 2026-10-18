# Openjutsu handoff

Updated 2026-10-17 for the move to `openjutsu/2`: Akatz Labs' H3 Character
Swap workflow and node pack, the v1.5 swap LoRA, an automatic first-frame
anchor, and pricing by resolution. `README.md` beside this file is the workflow
contract; `BENCHMARK.md` holds the measured costs.

## Where everything is

| Thing      | Where                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| The app    | This branch: the graph swap on top of Comfy-Org/ComfyUI_frontend#20965 (`openjutsu/1`)                    |
| Backend    | A follow-up to Comfy-Org/cloud#13014 (merged): new `target` and pricing for the three `openjutsu` entries |
| Deployment | `dep-1addaa09-5d25-4247-af0e-a79c57f7797a`, Comfy workspace, release `9e2ed871` (v4), 0 to 1 workers      |
| Previous   | `dep-72b51798-bde8-43f7-b689-e3302d861c97` serves `openjutsu/1` until the catalog moves; then it can stop |
| Flag       | `workshop-openjutsu-app-enabled` in PostHog: `comfy_staff` at 100%, nobody else                           |
| Build spec | Outside the repo: `~/comfyvibe/projects/comfy_workshop/openjutsu-v2/build-comfy/comfy-build.yaml`         |
| Graph tool | Outside the repo: `~/comfyvibe/projects/comfy_workshop/openjutsu-v2/h3-character-swap/make_graph.py`      |

## What is left, in order

1. **Merge #20965** (`openjutsu/1`); it needs a fresh approval.
2. **Ship this PR and the cloud follow-up together.** The catalog prices one
   graph per app: until both are out, whichever graph the catalog does not
   price is refused. The cloud change points `target` at `dep-1addaa09` and
   prices from `H3CharacterSwapPrepareVideo`:

   ```yaml
   price_per_second:
     node: H3CharacterSwapPrepareVideo
     seconds: duration_seconds
     tier: resolution
     credits: { '480': 8, '768': 16 }
   ```

   The Metronome row is an identity conversion, so no new rate is expected;
   confirm on BE-20899.

3. **Run one swap through the staging app proxy** signed in, and check the
   quote, the charge, the Router anchor and a refusal.
4. **Stop `dep-72b51798`** once the catalog points at `dep-1addaa09`.

## Decisions Rob has made

- 8 credits a second at 480p and 16 at 768p (2026-10-17), knowing 480p runs
  past one window cost more than they earn on the quick benchmark.
- The prompt box is optional extra direction; every run carries upstream's
  instruction.
- The anchor is automatic, from GPT Image 2.5 sunburst at low quality through
  Comfy Router, charged to the visitor separately; there is no upload for it.
- Custom nodes are now in: Akatz's pack, GPL-3.0.

## Worth a second look in review

- `anchor.ts` calls Comfy Router from the page with the visitor's sign-in,
  through `runWorkshopRouter` and the model's catalogue contract. A failure
  runs the swap without an anchor; a cancel stops the run.
- The app proxy sends deployments only the workflow, never `extra_data`, so a
  partner node inside the graph fails with "Please login first". That is why
  the anchor is made by the page, not by a node in the graph.

## Still open

- The MiniMax H3 Community License question, for anything public.
- A clip that opens on a frame with no person fails at SAM before generating.
- A cancel while the submit request is in flight is lost and the run bills; a
  failed cancel request is not noticed.
- A refusal because the deployment is stopped still reads "Something went
  wrong. Try again."
