# ADR-AGENT-GRAPH-0031: Extension-owned graph feedback

Date: 2026-09-16

## Status

Proposed

## Context

Agent-generated node feedback needs mutation provenance, turn completion, and
canvas presentation. Putting that policy in graph mutations, workflow-tab
activity, or the minimap couples application services to an optional extension.

Canvas components can unmount while a turn continues. Graph loading also clears
and reuses the canvas graph. Neither component lifetime nor node IDs alone can
identify the workflow that received a change.

## Decision

The agent extension owns provenance and reports. It observes successful node-store
actions and receives explicit turn events from the conversation store. Generic
canvas-overlay and minimap-layer registries expose presentation capabilities to
extensions without interpreting agent state. A shared viewport helper measures
host geometry from generic DOM attributes.

Marks use root graph, owning graph, and node identity. Workflow-load hooks retain
marks across tab switches only for the same workflow object with unchanged
incoming contents. Replacing contents or reopening a different object does not
inherit the report. Presentation remounts do not reset activity.

View opens the latest reported node's owning graph and frames reported nodes in
that graph. Combining bounds across graphs would combine unrelated coordinate
systems. Gold appears immediately; hydration staggers growth rather than initial
visibility. The extension owns reduced-motion policy and monotonic deadlines.

We rejected a host provenance service because actor classification belongs to
the extension. Component watchers cannot own turn history because remounting loses
the baseline. Path-keyed snapshots cannot distinguish replacement workflows.

## Consequences

### Positive

- Shared graph services do not import agent feedback policy.
- Deletion and graph reset remove live marks through existing node-store actions.
- Host framing and agent framing use the same visible canvas geometry.

### Negative

- Snapshot comparison clones workflow contents at load boundaries. Its cost grows
  with workflow size, and harmless serialized changes can discard feedback.
- Feedback remains session-local and does not survive a page reload.
- View frames one owning graph at a time when a report spans subgraphs.

## Notes

This decision addresses the ownership and lifecycle findings in
[PR #17730](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17730).
