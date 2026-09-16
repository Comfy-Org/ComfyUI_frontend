# ADR-WEBSITE-CATALOGUE-0032: Models and Workflows Browse as Two Catalogues

Date: 2026-09-16

## Status

Proposed

## Context

V1 of the Models catalogue ships models only, at `/models`. V2 has to decide
what happens to the 610 workflow templates the site already carries: do they
join the models in one list, or do they browse beside them as their own
catalogue?

The V2 prototype (#16556) built the merged version, so the question is not
whether that work is possible. It is what the real data does to it. The
numbers below come from `pnpm hub:audit-overlap`, which measures the committed
snapshot rather than quoting a figure that ages:

```
templates 610, of them apps 18
models 145
runnable here 72 (11.8%)
runnable apps 5 of 18
naming a catalogue model 101 across 18 models
need custom nodes 78
models cited 21: Nano Banana Pro 30, Nano Banana 2 9, Gemini Omni 1.1 Flash 4,
  Seedream 5.0 Pro 3, Seed Audio 1.0 3
titles that are a model name: Nano Banana Pro, Nano Banana, Flux.1 Kontext Pro,
  Flux.1 Kontext Max
runnable titles echoing their model 28
use cases edit-images 151, generate-images 136, animate-images 113,
  generate-videos 77, edit-videos 42, 3d 39, audio 35, text 17
unclassified 0
```

Two counts in there measure different things and are easy to confuse. 72
templates resolve to a model through the same task-aware, unique-match rule
navigation uses, so those are the ones the site could route to a model page.
101 templates merely name a catalogue model somewhere in `models[]`, across 18
distinct models. The wider count is the one that says how often a merged list
would repeat itself.

What the numbers mean for a merged list:

- **It repeats itself.** 101 of 610 workflows name a model that is also a card
  in the same list. Nano Banana Pro is named by 42 of them. Filtering a merged
  catalogue by _generate images_ puts the model and the workflows that run on
  it side by side, as if they were alternatives to each other.
- **Names collide.** Four workflow titles are a model name letter for letter,
  including `Nano Banana Pro`. One string, two meanings, two different next
  steps.
- **The sizes do not match.** The model is _Seedance 2.5_; the workflows are
  _Seedance 2.5: Text to Video_, _1080P: Image to Video_, _FLF2V_, _Video
  Extend_. Those are configurations of one capability, not competitors to it.
- **The next step is not the same step.** A model runs here, in the browser,
  against credits. A workflow is a JSON file opened in ComfyUI, needing the
  app, the weights, and in 78 cases custom nodes. One grid would promise one
  action and deliver two.
- **Only 11.8% could run here at all.** The prototype covered the other 538 by
  inventing a price, a rating, a rating count and a router id for each. Having
  to simulate the shape is the strongest evidence that the shape does not fit.

The groundwork for either answer is already in `main` and currently
unreachable: `src/components/hub/` (`HubBrowse`, `WorkflowGrid`,
`HubWorkflowCard`, `BrowseToolbar`, `HubUseCaseNav`), `src/lib/hub/`
(`workflow-detail.ts` with `getHubWorkflowPage`, the use-case mapping, the
routes), the template snapshot and its details, and `templateModelJoin.json`.
No route renders any of it, and `hubWorkflowPath` points at
`/models/workflows/<name>/`, which does not exist yet.

## Decision

Models and workflows stay two catalogues that read as one product.

- **Same vocabulary.** Both browse by use case. All 610 workflows already map
  into the same eight use cases the models use, with none unclassified, so
  this costs nothing to keep.
- **Same furniture.** One header, one card system, one search, one toolbar.
  The hub components already match the models ones.
- **Explicit crossings.** A model page says how many workflow templates use
  that model; a workflow page says which model it runs on and links to where
  it can be run. `templateModelJoin.json` stays the single source for both
  directions.
- **Run stays on the model.** Of the 72 workflows that could run here, 28 are
  titled after their own model, so running them from the workflow page is the
  model page with extra steps. Meanwhile only 5 of the 18 Comfy Apps can run,
  and apps are exactly where running in the browser would earn its place, since
  they are built for someone who is not wiring nodes. A Run button would land
  on 11.8% of pages, mostly where it duplicates something, and be missing where
  it would matter most. Keeping Run on the model turns a button on 11.8% of
  pages into a path from all of them.

This decides the axis and the Run button. It does not decide the workflow
page's contents, which is defined separately once V1 ships.

## Consequences

- No workflow card may ship before the workflow detail page has a route.
  `hubWorkflowPath` already resolves to `/models/workflows/<name>/`, so a card
  shipped today links to a 404. Porting that page off the prototype is the
  first piece of V2 work this decision implies.
- `Open in ComfyUI` needs a real destination. Today it points back at the hub
  this work replaces.
- The hierarchy is already modelled in the data: `WorkshopModel` carries
  `workflowCount` and the model page has an Examples tab. Merging would flatten
  a structure that exists; keeping two catalogues uses it.
- The two routes are cheap to delete now and expensive later. If the axis
  answer turns out to be no, a no today costs two route files, because
  everything underneath is shared and survives either decision.
- The numbers move whenever the template snapshot or the router catalogue is
  refreshed. `pnpm hub:audit-overlap` is committed so a future reader can
  re-run it rather than trust the figures above.

## Alternatives considered

**One merged catalogue, as the prototype built it.** Rejected for the five
findings above, each of which would have to be answered in the interface rather
than in polish: the repetition, the name collisions, the mismatch between a
capability and its configurations, the two different next steps, and the
invented data standing in for the 88% that cannot run here.

**Splitting on "runs here" against "open in ComfyUI" instead of on entity
type.** Kept open rather than rejected. It is the better answer if people
arrive already knowing whether they want to run something in the browser or
download a file, and the worse one if they arrive knowing what they want to
make and not yet how. That is the assumption this decision rests on, and it is
the first open question below.

## Open questions

1. **Is the axis right?** This assumes people arrive knowing what they want to
   make, not how they will make it. If the opposite is true, the merged
   catalogue is the better answer and this record should be superseded.
2. **What happens to Comfy Apps?** 13 of the 18 need multi-model orchestration
   the site does not have. Cloud roadmap, or accepted as a download for now.
3. **Templates or workflows?** The hub says workflows, the repo data says
   templates, the interface says both. Worth settling the noun once.
4. **Where does `Open in ComfyUI` go?**
5. **When is this decided?** The cost of deciding late is the two route files
   plus whatever is built on them.

## Implementation

`pnpm hub:audit-overlap` (`apps/website/scripts/audit-catalogue-overlap.ts`)
prints the table in the Context section. Re-run it after refreshing the
template snapshot or the router catalogue, and update this record if a number
moves enough to change the argument.
