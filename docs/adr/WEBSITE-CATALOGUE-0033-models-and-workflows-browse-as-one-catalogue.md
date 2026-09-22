# ADR-WEBSITE-CATALOGUE-0033: Models and Workflows Browse as One Catalogue

Date: 2026-09-16

## Status

Proposed

## Context

V1 of the Models catalogue ships models only, at `/models`. V2 has to decide
what happens to the 610 workflow templates the site already carries: do they
join the models in one catalogue, or browse beside them as their own?

The V2 prototype (#16556) built the merged version. A proposal on 14 Sep argued
for two catalogues instead, on the grounds that a model is a capability and a
workflow is a use of it. One catalogue is what Eric asked for and what V2 does.

The risk raised in the design meeting on 15 Sep is the one this record exists
to guard: with both kinds in one grid, the difference between a model and a
workflow has to stay legible to a reader who is not thinking about our data
model. So the measurements below are not a case against merging. They are the
list of what the merged catalogue has to answer in the interface, and each one
is a way that difference can blur.

The numbers come from `pnpm hub:audit-overlap`, which measures the committed
snapshot rather than quoting a figure that ages:

```
templates 610, of them apps 18
models 145
runnable here 72 (11.8%)
runnable apps 5 of 18
naming a catalogue model 101 across 18 models: Nano Banana Pro 42,
  Nano Banana 2 14, Kling 3.0 8, Seedance 2.5 7, Gemini Omni 1.1 Flash 5
api workflows 331: routable 72, naming a model the catalogue lacks 226,
  naming one without a single destination 33
need custom nodes 78
models cited 21: Nano Banana Pro 30, Nano Banana 2 9, Gemini Omni 1.1 Flash 4,
  Seedream 5.0 Pro 3, Seed Audio 1.0 3
titles that are a model name: Nano Banana Pro, Nano Banana
titles that differ from one only by case: Flux.1 Kontext Pro, Flux.1 Kontext Max
runnable titles echoing their model 28
use cases edit-images 151, generate-images 136, animate-images 113,
  generate-videos 77, edit-videos 42, 3d 39, audio 35, text 17
unclassified 0
```

Two counts in there measure different things and are easy to confuse. 72
templates resolve to a model through the same task-aware, unique-match rule
navigation uses, so those are the ones a card could route to a model page. 101
templates merely name a catalogue model somewhere in `models[]`, across 18
distinct models.

**What 11.8% is, and what it is not.** It is not a ceiling on what could run
here, and it is not a statement that the rest are local-only workflows. 331 of
the 610 templates carry the `API` tag, so more than half call a partner model
already. Of those 331 only 72 resolve: 226 name a model the catalogue does not
carry under that name, either because it is absent (MiniMax H3, PixVerse) or
because the workflow names a family while the catalogue lists operations (`Wan
3.0` against `Wan 3.0 Image-to-Video`), and 33 name a catalogue model but land
nowhere single, 19 of them because the catalogue itself lists that model once
per operation. The figure therefore
measures today's catalogue coverage and the strictness of the join, and both
are V2 work rather than facts of nature. Even for the 72, running the model is
not running the workflow: the site runs the capability underneath, not the
graph.

## Decision

Models and workflows browse as one catalogue.

What the data says the merged catalogue has to answer, each one in the
interface rather than in polish:

- **A model and the workflows that run on it are not peers.** 101 of 610
  workflows name a model that is also a card in the same list, and Nano Banana
  Pro is named by 42 of them. Filtering by _generate images_ must not put the
  model and its 42 uses side by side as alternatives. `templateModelJoin.json`
  already knows the parent, so the merged list can group or nest rather than
  repeat.
- **Names collide and must stay distinguishable.** Two workflow titles are a
  model name letter for letter, `Nano Banana Pro` and `Nano Banana`, and two
  more differ only in case. A card has to say what it is before it is clicked,
  which is what the type badge already in the prototype is for.
- **Configurations are not competitors.** The model is _Seedance 2.5_; the
  workflows are _Seedance 2.5: Text to Video_, _1080P: Image to Video_,
  _FLF2V_, _Video Extend_. Where a family repeats, the row should carry the
  capability and open its operations.
- **One grid, two next steps.** A model runs here against credits. A workflow
  is a JSON file opened in ComfyUI, needing the app, the weights, and in 78
  cases custom nodes. The card says which before the click, and the 78 say so
  too.
- **Nothing is invented to fill the shape.** The prototype gave the 538
  non-routable workflows a price, a rating, a rating count and a router id so
  they would sit in the same grid. A merged catalogue ships with the fields a
  workflow actually has, and leaves the rest out.

Both catalogues already share what makes merging cheap: all 610 workflows land
in the same eight use cases the models use, with none unclassified, and the hub
components mirror the models ones.

This decides the shape. It does not decide the workflow page's contents, which
is defined separately once V1 ships.

## Consequences

- No workflow card may ship before the workflow detail page has a route.
  `hubWorkflowPath` already resolves to `/models/workflows/<name>/` and nothing
  renders it, so a card shipped today links to a 404. Porting that page is the
  first piece of V2 work this decision implies.
- The join is load-bearing now. It is what keeps a model and its workflows from
  reading as alternatives, so its coverage is a product concern: the 226
  templates that name a model the catalogue does not carry are the gap to close
  first, and 126 of them name a family, an operation or a provider we already
  carry under another name. The 33 that land nowhere single are mostly ours: 19
  fail because one model is listed as several rows.
- `Open in ComfyUI` needs a real destination. Today it points back at the hub
  this work replaces.
- The catalogue needs a type facet with counts, and sort orders that mean
  something for both kinds: "popular" and "recent" do not read the same way for
  a capability and for a file.
- The numbers move whenever the template snapshot or the router catalogue is
  refreshed. `pnpm hub:audit-overlap` is committed so a future reader can
  re-run it rather than trust the figures above.

## Alternatives considered

**Two catalogues that browse the same way**, proposed on 14 Sep: same
vocabulary, same furniture, explicit crossings, and Run kept on the model. Its
case is the five findings above, and it answers them by keeping every card
comparable to the ones beside it. It was not taken, because it splits one
library into two places and leaves each crossing to navigation. The findings
survive the decision, which is why they are written here as constraints.

**Splitting on "runs here" against "open in ComfyUI"** instead of on entity
type. Still open, and it is the more interesting question now that the
catalogue is one: if people arrive knowing whether they want to run something
in the browser or download a file, that split may matter more than the type
badge does.

## Open questions

1. **Where does Run live?** Of the 72 workflows that could run here, 28 are
   titled after their own model, so running them from a workflow page mostly
   duplicates the model page. Meanwhile only 5 of the 18 Comfy Apps can run,
   and apps are where running in the browser would earn its place.
2. **What happens to Comfy Apps?** 5 of the 18 resolve. Of the other 13, eight
   are not partner workflows at all and run local weights; two name models the
   catalogue does not carry; two name a model it lists twice, once to generate
   and once to edit, and tag no task that would choose; one names a model whose
   page covers a different task. Only 5 of the 18 name more than one model, so
   the gap is not multi-model orchestration.
3. **Templates or workflows?** The hub says workflows, the repo data says
   templates, the interface says both. Worth settling the noun once.
4. **Where does `Open in ComfyUI` go?**
5. **How far does catalogue coverage go before V2 ships?** The merged
   catalogue reads better the more of the 331 API workflows point at a model
   that exists. 126 of the 226 name a family, an operation or a provider the
   catalogue already carries under another name, so half the gap is a mapping
   rather than a model.

## Implementation

`pnpm hub:audit-overlap` (`apps/website/scripts/audit-catalogue-overlap.ts`)
prints the table in the Context section. Re-run it after refreshing the
template snapshot or the router catalogue, and update this record if a number
moves enough to change the argument.
