# 27. Workflow-to-execution-payload transform

Date: 2026-08-23

## Status

Proposed

## Context

> **Reconstruction note:** Christian Byrne reconstructed this proposal from a
> Slack message in `#p-frontend-graph-improvements` posted at
> 2026-08-22T08:33:50Z (thread `p1787387630437609`). No transcript exists for
> Ben Cooley's proposal from the 2026-08-21 API v2 discussion. Sections marked
> **[reconstruction]** require Ben's confirmation before this ADR is accepted.

### The two formats

ComfyUI operates with two JSON representations of a workflow:

**Workflow format** (`ComfyWorkflowJSON`) — the save format. Contains the full
graph structure: nodes with positions and widget values, typed links, subgraph
definitions, metadata, and canvas state. This is what `.json` files and PNG
`workflow` metadata contain. Defined in
`src/platform/workflow/validation/schemas/workflowSchema.ts`.

**Execution payload** (`ComfyApiWorkflow`) — the prompt sent to the server.
A flat dict keyed by node ID: `{ [nodeId]: { inputs, class_type, _meta } }`.
Link references are `[sourceNodeId, sourceSlot]` tuples. Widget values are
inlined. Subgraphs are flattened to prefixed node IDs (e.g. `"11:3"`). Defined
in the same schema file; sent via `api.queuePrompt()` in `src/scripts/api.ts`.

### Where the transform lives today

`graphToPrompt()` in `src/utils/executionUtil.ts` (lines 26–161) is the
primary conversion function. It runs in this order:

1. **Virtual node application** — calls `node.applyToGraph()` on all virtual
   nodes in execution order, mutating the live graph.
2. **Graph serialization** — `graph.serialize()` produces the workflow JSON,
   strips `localized_name`, and calls `compressWidgetInputSlots()`.
3. **Node DTO map** — builds an `ExecutableNodeDTO` map that handles subgraph
   flattening; inner node IDs become `"parentId:childId"` prefixes via
   `workflowFlattening.ts`.
4. **Prompt assembly** — for each DTO: collects widget values (calling
   `widget.serializeValue` when present), resolves input links via
   `node.resolveInput()`, and handles the `__type__: 'CURVE'` and
   `__value__: array` wrapping conventions.
5. **Dangling link cleanup** — removes inputs referencing nodes not in the
   output map.

Several transforms happen outside `graphToPrompt()` and are not visible to it:

| Transform                                          | Location                                                   | Mechanism                                               |
| -------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Dynamic prompt `{a\|b}` substitution               | `src/extensions/core/dynamicPrompts.ts`                    | Overrides `widget.serializeValue` on `nodeCreated`      |
| Promoted widget control (`control_after_generate`) | `src/scripts/promotedWidgetControl.ts`                     | Called from `app.queuePrompt()` before `graphToPrompt`  |
| Widget value propagation for UI feedback           | `src/extensions/core/widgetValuePropagation.ts`            | Separate extension hook, not in prompt path             |
| Subgraph input promotion resolution                | `src/core/graph/subgraph/resolveConcretePromotedWidget.ts` | Called from within `node.resolveInput()` inside the DTO |

Extensions can change graph or node state before queueing through lifecycle hooks
such as `beforeConfigureGraph`, `nodeCreated`, `loadedGraphNode`, and
`afterConfigureGraph`. For example, `dynamicPrompts.ts` uses `nodeCreated` to
replace `widget.serializeValue`. These hooks do not define ordering,
idempotency, or permitted mutations.

### Why this matters

Any system that reads, modifies, or executes a ComfyUI workflow without the
frontend must independently reproduce every one of these transforms to faithfully
execute the workflow. This affects:

- **Agent mode** — constructs and submits prompts without user interaction.
- **Hub app mode** — executes workflows on behalf of users from a stored
  representation.
- **MCP tools** — invoke workflow execution from external processes.
- **Developer platform / API v2** — the long-stated goal is that the workflow
  file is the canonical artifact; the execution payload is derived state.

Related: FE-1577 (V2 API surface) covers the extension API rather than the
graph transform. Both land on the same consumers.

## Decision

**[reconstruction — needs Ben's confirmation]**

The proposal is additive: no break to the existing workflow format or execution
API.

1. **Centralize the transform.** All transforms that convert the workflow
   representation into the execution payload — virtual node application, link
   resolution, subgraph flattening, widget value serialization, dynamic prompt
   substitution, promoted widget control — are moved behind a single function
   with a documented, stable signature. This replaces the current scattered
   call-sites.

   This inventory is not exhaustive. #15704 also names ecosystem-level
   transforms that rewrite the graph before execution: Easy-Use
   "use everywhere" variables, KJNodes get/set nodes, and link rewrites.
   Those live in custom-node repos, not this codebase, so whether they enter
   the central pipeline (via the deferred registration contract) or remain
   outside the standard is open question 5.

2. **Make transforms replayable from the workflow.** Enough information about
   each transform step is encoded in the workflow JSON that the conversion can be
   reproduced outside the frontend without the live graph. Specifically:
   - The workflow already encodes subgraph structure; flattening must be
     derivable from `definitions.subgraphs` alone.
   - Dynamic prompt seeds or substitution results are optionally embedded so
     reproductions are deterministic.
   - Promoted widget values are carried by the host node's serialized state, not
     by interior subgraph nodes (consistent with ADR 0009).

   Caveat: the workflow JSON does not currently contain everything
   `graphToPrompt()` consumes. Some `widget.serializeValue` hooks produce
   runtime-only data — e.g. the painter widget uploads a canvas and returns a
   server-generated file reference, and promoted values can live in
   `useWidgetValueStore()` rather than the serialized graph. For each
   runtime-dependent transform, replay metadata in the workflow is mandatory,
   or the transform must be explicitly listed as non-replayable and excluded
   from the replayability guarantee.

3. **Version the existing pairing.** `api.queuePrompt()` already sends the
   execution payload as `prompt` and the workflow as
   `extra_data.extra_pnginfo.workflow`. Keep `ComfyApiWorkflow` flat and
   unchanged. Add version and provenance metadata to the request envelope, or
   use a sidecar for other persistence targets. Consumers must be able to reject
   a derived payload that is stale relative to its paired workflow.

Mental model: **workflow → explicit named transforms → execution payload**. The
payload is never edited directly; it is always regenerated from the workflow.

### What this ADR is not deciding

- The wire format of the API v2 prompt endpoint (FE-1577).
- Whether subgraph definitions should be changed (ADR 0009 governs that).
- How extensions register custom transforms after this centralization — that
  registration contract is deferred pending the centralized implementation.

### Enforceability as a standard for new code

**[reconstruction — needs Ben's confirmation]**

The specific ask from the 2026-08-21 discussion was whether this can be enforced
as a standard for new code. The reconstructed answer is: **partially at first,
fully once the registration contract exists**. Call-site restriction (new
transform logic goes through the central pipeline, not extension hooks or
`queuePrompt()` call-sites) is enforceable as soon as the centralized function
exists. Ordering, idempotency, and legal-mutation-state guarantees are not
enforceable until the extension registration contract — deferred above — is
defined, along with a migration boundary for existing `serializeValue` users.
At that point:

- New transform logic must be added to the central pipeline, not to extension
  hooks or `queuePrompt()` call-sites.
- Assigning `widget.serializeValue` from extension lifecycle hooks (as
  `dynamicPrompts.ts` currently does) is deprecated in favor of a registered
  transform step with explicit ordering and isolation guarantees.
- An ESLint rule or ADR compliance check can flag direct calls to `graph.serialize()`
  or `graphToPrompt()` from outside the designated transform module.

## Consequences

### Positive

- External systems (Agent, Hub, MCP, CLI tools) can execute any workflow
  faithfully without reimplementing frontend-only transforms.
- The transform pipeline becomes testable in isolation — no live graph required.
- Extension authors get a documented, stable hook rather than relying on
  `widget.serializeValue` override or timing-dependent `beforeConfigureGraph`.
- Provenance information in the persisted payload enables future validation,
  debugging, and replay.

### Negative / risks

- **Migration cost.** `dynamicPrompts.ts`, `promotedWidgetControl.ts`, and any
  third-party extension using `serializeValue` overrides must be migrated. The
  `serializeValue` override pattern is used by the extension ecosystem (40+
  custom node repos per ADR 0008 amendment).
- **Ordering sensitivity.** The current transforms run in an implicit order
  determined by call-site position and extension registration sequence. Making
  that order explicit may reveal latent bugs in extensions that rely on it.
- **Reconstruction uncertainty.** This ADR is reconstructed from a single Slack
  message. The specific encoding decisions (what exactly goes into the workflow
  to make transforms replayable) are not fully specified and must be detailed
  before implementation begins.

## Open questions (requires Ben's input)

1. Which transforms must be replayable outside the frontend in the initial
   scope, and which are deferred?
2. Should the persisted execution payload be in the PNG `pnginfo`, a sidecar
   file, or the queue request body only?
3. Is the `serializeValue` deprecation in-scope for this proposal, or is it a
   follow-on once the central pipeline stabilizes?
4. Does "encode enough about transforms in the workflow" mean storing transform
   output (e.g. resolved dynamic prompt values) or transform parameters (e.g.
   random seed used)?
5. Are ecosystem-level graph rewrites (Easy-Use "use everywhere" variables,
   KJNodes get/set nodes, link rewrites — see #15704) in scope for the central
   pipeline via the registration contract, or explicitly outside the standard?
