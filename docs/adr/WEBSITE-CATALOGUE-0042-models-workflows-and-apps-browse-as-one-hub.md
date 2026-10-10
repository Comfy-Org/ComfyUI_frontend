# ADR-WEBSITE-CATALOGUE-0042: Models, Workflows and Apps Browse as One Hub

Date: 2026-10-10

## Status

Accepted

## Context

The site carries three kinds of thing a visitor might want: partner models it
can run in the browser, workflow templates meant to be opened in ComfyUI, and
Comfy Apps. V1 shipped the models catalogue alone, at `/models`. V2 had to
decide whether the other two join the models in one catalogue or browse beside
them as their own.

A merged catalogue was asked for and prototyped. The risk raised against it was
not that merging is wrong but that the difference between a model and a
workflow has to stay legible to a reader who is not thinking about our data
model, and a single grid blurs it in specific, countable ways: a model and the
workflows that run on it are not peers, workflow titles collide with model
names, a family's operations are configurations rather than competitors, and
one grid would carry two different next steps.

The earlier draft of this record (#17791, closed) argued the merge from a
snapshot of the catalogue taken in September 2026. Those figures are not
restated here, because they have not been re-measured against what shipped and
a number nobody can reproduce is worse than no number.

## Decision

Models, workflows and apps browse as **one Hub with three sections**, not as
one grid and not as separate catalogues.

- `/hub/models/`, `/hub/workflows/` and `/hub/apps/` are three routes behind
  one tab bar. `ModelsCatalogue.vue` owns the tabs and renders exactly one of
  `WorkshopModelsGrid`, `WorkflowCatalogue` or `AppCatalogue` per section.
- The sections share their furniture: the same sticky toolbar, the same shelf
  and grid layout, and the same card shape and width from `card-layout.ts`.
  What differs is the listing, not the way it is browsed.
- Each section lists one kind. A model and the workflows that run on it never
  appear in the same list, which is how the central objection to a single grid
  is answered: by not putting them side by side at all, rather than by labelling
  them once they are.
- Models and workflows carry the full toolbar — search, the use-case filter and
  sort — over the same eight use cases, so the filter means the same thing in
  both and a reader carries one vocabulary between them.
- Apps carry only the tabs. `AppCatalogue` mounts no search, filter or sort,
  because a shelf of a handful of apps is read rather than searched. The tab is
  therefore a deliberate exception to "browsed the same way", and the moment
  the apps list grows past a screenful it needs revisiting.

This settles the shape of browsing. It does not settle what belongs on a
workflow page, or where Run lives for a workflow that could run here.

## Consequences

### Positive

- One set of furniture to build, test and restyle. A change to the toolbar,
  the shelves or the card lands in all three sections at once, which is what
  made the Hub-wide design pass (#20333) a single piece of work.
- The type of a card is implied by the section it is in, so the interface does
  not have to disambiguate a workflow titled exactly like a model.
- Each section can answer its own kind honestly: a model card can carry a price
  and a Run, a workflow card does not have to pretend to.

### Negative

- A visitor who does not know whether what they want is a model, a workflow or
  an app has to pick a tab before they can look. Search is per section, so the
  thing they want can be one tab away with no sign of it.
- Three listings is three surfaces to keep consistent. They share components,
  but nothing structural stops them drifting; consistency is maintained by
  convention and by tests, not by the type system.
- The split is by kind rather than by "runs here" against "open in ComfyUI",
  which may be the division a visitor actually has in mind. That remains open.

## Notes

Open questions this record does not answer:

1. Where Run lives for a workflow that resolves to a model the site can run.
2. Whether the tabs should split on "runs here" against "open in ComfyUI"
   instead of on kind.
3. Whether the interface says _workflows_ or _templates_; the Hub, the repo
   data and the copy do not currently agree.

Written after the fact, from the code as it stands at the Hub design pass
(#20333). It records a decision already built and in production rather than
proposing one.
