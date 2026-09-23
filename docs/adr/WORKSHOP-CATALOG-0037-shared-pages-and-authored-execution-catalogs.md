# ADR-WORKSHOP-CATALOG-0037: Shared pages and authored execution catalogs

Date: 2026-09-23

## Status

Accepted

## Context

The existing Models content defines pages and their INPUTS widgets. A separate
Router catalog describes the native request contract. FE-2736 adds curated
workflows to that product. The user clarified that workflow preparation happens
offline when catalog content is authored; extracting an editor APP interface is
outside this feature. This replaces the publication/export proposal in
[WORKSHOP-WORKFLOWS-0036](WORKSHOP-WORKFLOWS-0036-published-app-definitions-and-durable-cloud-runs.md).
Its separate Cloud admission, billing, recovery and media requirements remain.

## Decision

Keep the existing master pages source and Router endpoint source. Add one
workflow JSONL file for Cloud and serverless/API execution declarations, with
one complete record per workflow. Preserve existing Models identities and file
formats; do not introduce replacement master or Router catalogs.

These files are the publication store for this phase. Catalog database tables,
Router/workflow publishing APIs and automatic workflow input compilation are
future work. A later migration can preserve the declared content and IDs; this
feature does not need a storage abstraction built in anticipation of it. Durable
run, receipt and media records serve execution/recovery and remain separate from
catalog publishing.

- The master pages source owns names, copy, examples, INPUTS widgets and their
  presentation. A page declares its MODEL, CLOUD or SERVERLESS target and stable
  target ID. Existing Router page identity mappings remain valid.
- The Router source owns Router endpoint request/response information.
- The workflow JSONL source owns actual workflow input IDs, types, defaults,
  fixed request data, explicit mappings from existing page input IDs, selected
  outputs, and the graph/version or deployment information needed for execution.
  Reuse Router's declarative request-schema conventions. Widget definitions are
  not duplicated in the workflow catalog. Keep credentials in server configuration.

A visible page must exist in the master source and resolve to a matching entry
in the appropriate execution catalog. A catalog entry alone creates no page;
an unmatched master entry creates neither a listing nor a detail route. Apply
the existing publication/rollout gates after this match. Match stable typed IDs,
not display names, list positions or guessed aliases. Use the same resolved set
for discovery, direct routes and page data.

Share form controls, input/output panels and schema-driven validation across
target types. Page layouts may differ where the design calls for different
navigation, template details or examples. PR #18325's workflow layout does not
need to inherit the Router page's surrounding composition. Avoid copying forms
or validation to accommodate those differences. Validation operates on declared types, required values,
choices, ranges and media limits; it does not branch on the rendering provider.
Type-specific presentation and output-specific playback are small variations
within shared components. The page calls a common render boundary and receives
common status, field errors and output objects. Provider request preparation,
transport, authentication and result normalization stay behind that boundary.

Published workflows use the existing supported INPUTS control set. Custom input
widgets, widget code supplied by publishers and an input plugin system are not
planned. Do not treat those as future capabilities that the current design must
accommodate. Optional future input compilation produces declarations for the
supported controls.

The catalog author inspects each selected workflow and prepares its record by
hand or with an intermittently invoked offline tool. The committed JSONL is the
runtime input. The website does not extract APP selections, traverse subgraphs
to discover bindings, run widget serializers, or compile editor workflows during
build or page use. Any Cloud graph input substitutions are explicitly listed
in the record; nested IDs and multiple targets are already resolved data.

Check the prepared records and their input mappings before publication, using
the common schema validator and known request fixtures. Runtime input validation
uses those declared constraints. Backend authorization and native execution
checks still apply; their errors are normalized at the render boundary. Missing
metadata is corrected offline, never inferred or repaired while rendering a page.

### Alternatives considered

- Automatic APP extraction and custom serializer support would couple the site
  to the editor and expand compatibility work. Future authoring tooling can
  produce the same JSONL, independently of the shipped page.
- Independent forms and validation for every provider would duplicate behavior.
  Share these components and the render boundary; choose page composition from
  the product design instead of requiring every page to have one template.
- Workflow records containing their own widget lists would duplicate the
  existing master INPUTS authority and allow the forms to diverge.

## Consequences

### Positive

Adding a curated workflow is primarily content preparation. Models and
workflows share page behavior and validation. The execution catalog carries the
provider differences, and preparation tooling can evolve independently.

### Negative

Publishers must keep page input IDs and workflow mappings consistent and verify
each prepared workflow. Published forms are limited to the supported controls;
custom inputs are outside the planned product. Real Cloud/serverless execution
must still be tested; schema validation alone does not prove runtime
availability or billing.

## Notes

PR #18325 remains the presentation reference. FE-2736 implements Cloud execution;
the workflow catalog accommodates serverless/API records without bringing
FE-2737 sponsored execution into this phase. The editor exporter branch is no
longer a dependency or a planned frontend PR for this feature.
