# ADR-EXECUTION-ROUTING-0050: Job-scoped node transition events

Date: 2026-11-12

## Status

Proposed

## Context

[Parallel Execution M1](https://app.notion.com/p/4166d73d365080478ec4f8df263d354d)
requires execution messages to retain prompt and workflow identity (S6), and
one job's transitions to leave other jobs' progress untouched (S4, S5, D7).

The backend's `executing` frame contains `prompt_id` and may carry
`workflow_id`. The public frontend event exposes only the display node ID,
or null at the end of a run. That shape is an extension-facing contract.
Using it to clear buffered progress discards other jobs' frames and lets a
background job's terminal null clear the foreground job.

## Decision

Dispatch an additive `executing_with_metadata` frontend event containing the
unaltered backend frame, before the existing node-only `executing` event.
The execution store consumes the full frame. Existing extension listeners
and canvas invalidation continue to receive the original event shape.

A node transition removes only that prompt's pending scalar progress. A
terminal frame also removes only that prompt's pending node-state snapshot.
The shared animation-frame callbacks remain scheduled while other prompts
have pending updates. Nonterminal transitions retain node-state snapshots,
including multiple async branches within one prompt.

Only a frame whose prompt matches `activeJobId` may clear the visible scalar
progress or active prompt. Workflow ownership alone cannot decide this:
two concurrent runs can belong to the same workflow instance. The optional
workflow stamp is remembered using the resolver in
[ADR-EXECUTION-ROUTING-0049](EXECUTION-ROUTING-0049-workflow-ownership-for-websocket-frames.md).
Older servers that supply a prompt ID without a workflow stamp remain
supported; the client does not manufacture a missing workflow ID.
Transitions without a prompt ID cannot own any pending updates and are ignored
by the execution store.

Buffered scalar progress also requires a matching active prompt at flush time.
If the active run stops before the next animation frame, another run's retained
scalar update cannot become visible merely because `activeJobId` is now null.
Background node-state snapshots remain available in the per-job map.

## Alternatives considered

- Change the existing `executing` event to an object: breaks extensions
  expecting a node ID or null.
- Reconstruct the prompt from `activeJobId`: assigns interleaved frames to
  whichever run is visible, losing the backend's authoritative identity.
- Filter by workflow ownership: cannot distinguish two runs of one workflow.

## Consequences

The adapter emits both event shapes, but the execution store subscribes only
to the job-scoped event, avoiding a second global reset from the legacy event.
Synthetic execution producers targeting the store must use the full frame.

This change is an M1 prerequisite. Explicit run selection, per-job canvas
outputs and errors, all-job queue progress, snapshot recovery, scoped cancel
parity, core async scheduling and Cloud entitlement/billing verification remain
separate deliverables. It does not enable backend concurrency or turn on the
Cloud rollout flag.
