# ADR-WORKSHOP-BROWSE-0040: One model catalogue, with execution target as a filter

Date: 2026-10-06

## Status

Rejected — proposed and withdrawn the same day, once the contents of the two
catalogues were counted. Retained so the proposal is not made again.

## Context

Two model catalogues are live at once, and both present themselves as the
catalogue of models.

`/hub/models/` holds 148 Router model pages. Its title is "ComfyUI Models: Run
AI Image, Video & Audio Models" and its description promises "Browse 148 AI
models in ComfyUI … Try any model in your browser, then call it from your code".
Each detail page carries Playground, API and Details tabs.

`/p/supported-models/` holds 394 entries, of which 334 are published file pages.
Its h1 is "Supported Models" and its description is "Run the world's leading AI
models in ComfyUI" — which is also, word for word, a section heading inside
`/hub/models/`.

Two open changes widen the overlap rather than resolve it. #19786 gives the
supported-models index a Trending row, a Latest row, browse-by-task and
browse-by-family, and an h1 of "Every model. One graph."; seven of the nine
distinct models in those showcase rows are Router models whose detail pages live
under `/hub/models/`. #20291 moves the section to `/hub/models/local/` under a
new registry kind `local`, keeping its own index, `all/` page and `llms.txt`.

The overlap is real and measurable. The proposal below read it as one catalogue
split by execution target, and that reading was wrong.

## Decision

**Rejected: do not index Router models and local model files together, and do
not add an execution-target filter to do it.** The nested `local` section in
#20291 is the correct shape.

The two sets are not one catalogue split by where a model runs. Counted from
`apps/website/src/config/generated-models.json`, the 394 supported-models
entries are:

|                                     | Count |
| ----------------------------------- | ----: |
| Files with a Hugging Face link      |   345 |
| Partner (API) integrations, no file |    49 |

and the 345 are not runnable models. They are the parts of a local install,
filed by the directory each belongs in: 132 diffusion models, 69 LoRAs, 50 text
encoders, 32 checkpoints, 25 VAEs, 8 model patches, 6 clip vision, 6 ControlNets,
4 latent upscalers, 3 audio encoders, then detection, background removal, frame
interpolation and optical flow. A LoRA, a VAE or a text encoder cannot have a
Hub page, because it is not something a visitor calls — it is something they
install. Several of those categories are not generative models at all.

One grid holding both would place a VAE file beside Kling O3, which compares
what does not compare. DES-1054 settled this axis on 18 September — one search,
one sort, two tabs, no filter menu — and explicitly superseded a "what it needs
(runs here / needs ComfyUI / needs custom nodes)" facet. This ADR revived that
facet without knowing it had been considered and dropped.

The duplication also has a documented origin rather than a product intent.
`MODELS_INTEGRATION_PLAN.md` (10 September) required that the pre-existing
public `/models` marketing page stay unchanged while the Workshop models work
sat behind `WORKSHOP_IN_BUILD`, because "deleting all `/models` output would
delete a pre-existing public route". The two catalogues are the cost of gating
the new one, paid deliberately.

## Consequences

Two narrower findings survive the rejection, and neither needs this ADR:

- **The real overlap is the 49-entry partner tail, where the Hub is the smaller
  set.** `partnerModelHubSlugs` maps 20 of the 49 onto 14 distinct Hub pages and
  leaves 29 with no Hub equivalent — Claude, ElevenLabs, DALL·E, Runway,
  Ideogram, Recraft, Topaz, Tripo 3D, Vidu, MiniMax, FLUX API, LTX-2, Meshy,
  Qwen-3, OpenRouter among them. #20291 sends those 29 to `/hub/models/`, which
  retires 29 provider pages into a generic index. That is a content decision for
  the design owner, not a redirect detail.
- **The page is mislabelled, not duplicated.** Its own description — "open-weight
  components and partner integrations" — is accurate; #19786's new h1, "Every
  model. One graph.", overclaims on a page that is 88% install components. It
  also explains the Trending row: usage is measured in Cloud, and the 345 local
  files run on the visitor's own machine, so they generate no usage signal and
  can never appear there. CodeRabbit's merge-risk note on #20291 reaches the
  same mislabelling from the other end.

## Alternatives considered

**One index, execution target as a filter** — this ADR's original proposal.
Rejected for the reasons above: 88% of one set is not a model in the other set's
sense, and the axis was already settled and the facet already dropped.

**Keep two indexes, nested, as #20291 implements.** Accepted in practice. It
matches how the Hub already separates workflows from apps, and the separation is
by what a thing is after all: a callable model versus a file you install.

**Merge the detail pages into one template that switches on target.** Rejected
for the same reason, more strongly: a Playground and a file download share
almost nothing.
