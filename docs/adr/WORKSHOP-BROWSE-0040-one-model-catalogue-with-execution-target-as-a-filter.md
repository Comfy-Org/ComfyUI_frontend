# ADR-WORKSHOP-BROWSE-0040: One model catalogue, with execution target as a filter

Date: 2026-10-06

## Status

Proposed

## Context

Two model catalogues are live at once, and both present themselves as the
catalogue of models.

`/hub/models/` holds 148 Router model pages. Its title is "ComfyUI Models: Run
AI Image, Video & Audio Models", its h1 is "ComfyUI models", and its description
promises "Browse 148 AI models in ComfyUI … Try any model in your browser, then
call it from your code". Each detail page carries Playground, API and Details
tabs.

`/p/supported-models/` holds 334 published open-weight file pages out of 411
canonical entries. Its h1 is "Supported Models" and its description is "Run the
world's leading AI models in ComfyUI". Each detail page carries a Hugging Face
download button, the folder the file belongs in, and a docs link.

The overlap is already visible in the copy: "Run the world's leading AI models"
is simultaneously a section heading inside `/hub/models/` and the entire meta
description of `/p/supported-models/`.

Two open changes widen it rather than resolve it:

- #19786 restores the supported-models index and gives it a Trending row, a
  Latest row, browse-by-task and browse-by-family, and changes its h1 to "Every
  model. One graph." Seven of the nine distinct models in those two showcase rows
  are Router models whose detail pages live under `/hub/models/`, not on this
  page. Cards in the rows are visually identical but lead to two different page
  templates, and a reader cannot tell which before clicking.
- #20291 moves the section to `/hub/models/local/` under a new registry kind
  `local`, keeping its own index, its own `all/` page and its own `llms.txt`.
  URLs converge; the two indexes remain, one nested inside the other.

The Hub's URL registry (`apps/website/src/config/models-url-registry.ts`) has
kinds `hub`, `section`, `model`, `workflow` and `app`. Its sections — models,
workflows, apps — separate **what a thing is**. A `local` section separates
**how a thing runs**. Those are different axes, and placing both in one URL
hierarchy is what produces the duplication: one model concept appears in two
indexes according to its execution target.

[WORKSHOP-CATALOG-0037](WORKSHOP-CATALOG-0037-shared-pages-and-authored-execution-catalogs.md)
(Accepted) already declares the target per page — a page "declares its MODEL,
CLOUD or SERVERLESS target and stable target ID" — and requires discovery to use
"the same resolved set for discovery, direct routes and page data". The data that
distinguishes these pages is therefore already authored. Only the browse surface
treats them as two products.

## Decision

One catalogue indexes every model. Execution target is a filter within it, never
a separate index.

- `/hub/models/` is the single entrance to models: one grid, one search, one
  showcase.
- Execution target — runs on your own machine, versus runs in the cloud or
  through the Router API — is a filter control in that grid, derived from the
  target each page already declares. It is not a distinct route with its own
  index, `all/` page or `llms.txt`.
- A card states its execution target before the click. The card already carries
  a kind badge separating model from workflow from app; target is the second
  fact it must carry, because the two lead to different page templates and
  different promises.
- Detail pages stay two templates. A Router model page offers a Playground and
  an API tab; an open-weight file page offers a download, a folder and a docs
  link. WORKSHOP-CATALOG-0037 already permits layouts to differ where the design
  calls for it while form controls and the render boundary stay shared.
- Showcase rows belong to the single index and name the slice they show. A row
  ranked by measured Cloud usage can only ever contain cloud-executed models;
  inside one catalogue with a visible target filter that is a legible slice
  rather than an unstated contradiction.
- The catalogue is named Hub, and Models is a section inside it, as workflows
  and apps already are. The open "Models or Hub" naming question follows from
  this structure instead of from preference.

Old addresses keep working. The redirect set in #20291 is still required; its
destination becomes the single index with the target filter applied, rather than
a nested index.

## Consequences

Good:

- One page answers "which models can I use", for readers and for answer engines.
  Two pages currently compete for that question with near-identical descriptions.
- The card tells the truth before the click, which removes the present defect
  where identical cards lead to two page templates.
- The Trending-versus-open-weights contradiction in #19786 dissolves, because
  the row is explicitly a slice of one catalogue.
- The naming decision stops being a matter of taste.
- No new data is required: the target is already declared per page.

Costs:

- #20291 has to change shape before it merges, or be followed by a change that
  folds its nested index into the parent. Its redirect table, slug groups and
  published-pages fixtures survive either way; the index, `all/` page and
  `llms.txt` it adds under `local/` do not.
- #19786's showcase rows need to declare their filter, which is design work that
  has not been requested yet.
- One grid over 148 Router pages plus 334 file pages is a larger first paint and
  a harder filter-state problem than two smaller grids. The full directory
  already pages at 24 entries at a time and the default filter reduces the
  starting set, but the LCP ordering in #20200 should be re-measured against the
  merged index rather than assumed to hold.
- The two indexes currently earn traffic separately; #20291 reports roughly 45k
  clicks per 90 days across the supported-models file pages. Collapsing to one
  index concentrates index-level traffic on a single URL. Detail pages keep
  their own addresses and the redirects preserve their link equity, so the risk
  sits on the index pages, and it should be measured after the change.

## Alternatives considered

**Keep two indexes, nested, as #20291 proposes.** The smallest change, it
preserves both branches as written, and it matches how the Hub already separates
workflows from apps. Rejected because the Hub's sections separate what a thing
is, not how it runs. A `local` section mixes the two axes, and the duplication a
reader meets is not removed — it moves one level deeper.

**Keep two indexes, unnested, and differentiate the copy.** Cheapest of all:
leave the addresses alone and rewrite each title and description to claim only
its own half. Rejected because #19786 moves the other way — it adds Hub-shaped
browse patterns and a title claiming every model — and because two indexes still
split one question across two answers.

**Merge the detail pages as well, into one template that switches on target.**
Rejected: a Playground and a file download are different enough that a single
template would carry two mutually exclusive halves, and WORKSHOP-CATALOG-0037
already allows these layouts to differ.
