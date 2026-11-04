# ADR-SUPERCOMFY-ENGINE-0052: Batch fan-out and run reuse

Date: 2026-11-04

## Status

Proposed

## Context

SuperComfy is a prototype layer above the root graph. Its nodes are I/O nodes
(image, text, video, audio, 3D), Generate nodes that call one Comfy Router
model, and App nodes that run one of the account's app workflows on Comfy
Cloud. Every I/O node holds a batch, and every executable node can run alone
or as part of a graph run.

Batches multiply paid runs, and a graph run can reach many Router and Cloud
jobs. The engine therefore needs a fixed answer to four questions: how batches
combine into runs, when a node that already has a result runs again, what
downstream receives when some runs fail, and how a node describes its inputs
when they come from a Router model schema or from an app's app mode selection.

## Decision

**A pure engine owns run planning, scheduling and reuse.** It lives in
`src/renderer/extensions/superComfy/engine/`, imports nothing from Vue, Pinia
or litegraph, and receives the Router and Cloud executors by injection. One
reducer applies both document edits and run events.

**Fan-out is per source node.** Each upstream node whose batch holds more
than one item is a dimension. When one node feeds several ports, its batches
stay paired by position, so an App's image and mask from the same run arrive
together; if their sizes differ, each edge is its own dimension. A node plans
the product of its dimensions times its run count, with the first dimension varying slowest and the repeat innermost, so
outputs stay grouped by input combination. A multi-item input takes one item
from each of its edges per run: separate single-item nodes fill it together,
and a batch from one node still fans out. I/O nodes downstream collect every
output in run order, and only after every upstream node has finished all of
its runs.

**Runs are cached by key.** A run key hashes the node's settings, model id or
app version, contract version, the identities of its input items and its
repeat index. Identity is the file reference or the text, never the bytes. A
graph run skips a node whose last complete result has the same keys in the
same order, and otherwise runs only the keys it has no record for. Failed
runs therefore retry alone, a grown batch runs only the new combinations, and
Stop then Run resumes. A late success from a stopped session is kept for
reuse but never becomes the node's result. A node's own Run regenerates every
run.

**A failed run never stops its siblings.** It is recorded with the server's
message. Downstream receives only the successful outputs, in run order. When
every run of a node fails, nodes downstream of it in that graph run are
blocked and unrelated branches still finish. No failure kind cancels sibling
runs.

**Router inputs come from a generic mapper plus typed families.** Picking a
model rebuilds the node's sockets and settings from its OpenAPI schema. A
structural mapper recognises the flat, Anthropic Messages, OpenAI Chat, OpenAI
Responses and Gemini Contents shapes. Nested wire formats it cannot infer are
typed TypeScript families with their own ports, body and result reader, in the
spirit of ADR-WEBSITE-REQUESTS-0030. Models with no supported shape are hidden
and counted.

**App nodes resolve and run on a detached, id-isolated `LGraph`.** Before
configuring, the root id and every subgraph definition id are re-minted, so
`configure` and `clear` never wipe canvas stores keyed by the open graph's id,
and registered subgraph types never replace the canvas's. The graph is
disposed after each node execution, and its registered types are removed.

## Alternatives considered

- **Zip batches instead of crossing them.** Simpler to explain for equal
  lengths, but undefined for unequal ones and contrary to the requirement that
  three images and two prompts make six runs.
- **Make every edge its own dimension.** One rule for all edges, but one
  node's batch wired into two ports would cross with itself and pair outputs
  from different runs.
- **Treat each edge into a multi-item input as its own run.** Breaks the
  reference-image case, where separate images must reach one run together.
- **Re-run every node on every graph run.** Simplest, but it pays again for
  unchanged work and makes Stop then Run start over.
- **Hash media bytes for run keys.** Catches a re-upload of identical bytes,
  but costs a download per item on every plan. Reference identity errs on the
  side of re-running.
- **Cancel sibling runs on the first failure, or pass nothing downstream from
  a partial node.** Wastes completed paid work and hides usable outputs.
- **One hand-written adapter per Router model, or a template language.**
  Hand-written adapters do not scale to the catalogue, and a template language
  moves logic out of the type system. The generic mapper covers most models
  and families cover the rest.
- **Run apps on the canvas root graph.** Repaints and mutates the user's open
  workflow. A detached graph without id isolation wipes the canvas stores that
  share its id.

## Consequences

### Positive

- Every batching and reuse rule has a unit test with fake executors, so no
  test spends credits.
- Unchanged nodes cost nothing on a graph run, and the planned run count is
  known before anything is submitted.

### Negative

- A re-upload of the same bytes under a new name counts as a change.
- The schema mapper is heuristic. Misread fields need a typed family.
- A detached app graph still runs node constructors and graph-load hooks, so a
  custom node with global side effects can leak them.
