# ADR-RENDERING-DOM-0062: Keep Vue node markup small

Date: 2026-11-24

## Status

Proposed

## Context

A wrapper in a Vue node header, slot, or widget is rendered once per instance.
On a large workflow, small bits of unused markup add up. The
[first cleanup](https://github.com/Comfy-Org/ComfyUI_frontend/pull/24237)
reduced the element count, but the benchmark did not establish a speedup.

## Decision

In Nodes 2.0, keep a DOM element when it has a job in the rendered UI. Use an
existing element when it can do that job, or a Vue fragment when children only
need to be grouped in the template. Render optional UI only when needed, unless
its element must stay mounted to preserve layout or state.

Keep native labels, named groups, hit targets, and anchors for tooltips or
measurement. When removing a component root, preserve the attributes,
listeners, and refs that callers rely on.

## Alternatives

- A wrapper per component makes styling and attribute forwarding convenient,
  but makes the DOM follow the source structure even when the UI does not need it.
- A fixed element budget would catch growth, but it would also flag legitimate
  controls and semantics. An absolute count depends on the workflow and state.
  Compare matched renders in review instead.

## Consequences

Review changes to repeated markup for both element count and behavior. Use
counts to show structural savings and timing benchmarks to support speed claims.
Follow the [Vue markup guidance](../guidance/vue-components.md#rendered-markup)
when changing these components.
