# ADR-PROPERTIESPANEL-0056: Renderer home and hosted-domain seams

Date: 2026-11-12

## Status

Accepted

## Context

The properties panel was spread across `src/components/rightSidePanel`,
`src/stores/workspace`, and `src/composables/graph`, and its own code was
named both "right side panel" and "properties panel". Platform code
deep-imported panel internals: workflow errors read error-navigation state from
the panel store, used the panel's collapse toggle, and telemetry read the
panel's open state. The panel in turn computed errors-tab relevance and
severity itself, so the panel and workflow errors depended on each other.

The panel imports the canvas store and the Vue widget runtime under
`src/renderer`. The layer rule (base, platform, workbench, renderer) therefore
rejects a home in `src/platform` or `src/workbench` without new suppressions.

## Decision

The panel lives in one app home, `src/renderer/extensions/propertiesPanel`,
named "properties panel" in files and symbols. Other modules use only three
entry points: `PropertiesPanel.vue`, `propertiesPanelStore.ts`, and
`favoritedWidgetsStore.ts`. Deep imports are enforced.

Workflow errors own the errors-tab request state
(`errorsTabRequestStore.ts`) and the errors-tab indicator
(`useErrorsTabIndicator.ts`). The panel consumes both; nothing in platform
imports the panel. `openPanel` reports whether it opened, so callers request
error details only when the panel is available.

The panel remains the composition root that provides the workflow error
manager and the ask-agent port to the errors tab, because platform code cannot
import the workbench implementations. `GraphView.vue` passes the panel's open
state to the shell layout telemetry snapshot.

The subgraph editor stays nested in the home under the subgraph-promotion
claim. The collapse toggle is a design-system accordion control with label
props.

Persisted and reported identifiers keep their names: the
`Comfy.RightSidePanel.*` settings, the `right_side_panel*` telemetry
identifiers, and the `rightSidePanel.*` locale keys shared with workflow
errors.

## Alternatives

- A `@comfyorg/properties-panel` package has no second consumer, and its
  search, selection, and parent-group logic depend on LiteGraph runtime guards
  in `src/lib`.
- A home under `src/platform` or `src/workbench` needs suppressions for every
  renderer import.
- Renaming only inside `src/components` keeps a technical folder and leaves
  platform deep imports unenforced.
- Moving the open state to a workbench dock store splits `openPanel` across
  two stores that must agree.
- Renaming settings, telemetry, or locale identifiers breaks persisted
  settings, dashboards, and 14 locale files without an ownership gain.

## Consequences

Panel internals can change without touching other domains. Workflow errors
render their own tab state and no longer form a cycle with the panel. A
platform module that needs panel state must receive it from a higher layer.
