# ADR-038: cmp-owned, op-id-derived ID remapping for `insert_workflow`

**Status**: accepted
**Date**: 2026-09-12
**Implementation-status**: implemented
**Renumbered**: was `ADR-031` from 2026-09-13 (`5a2355dc6b00`) to 2026-09-24 (`clean-5`). It
collided with `ADR-031-renderer-provided-layout-port-for-agent-materializer.md`, which was added
first (2026-09-10, `50a0a2752ebf`) and keeps the number. Any citation of "ADR-031" that concerns
`insert_workflow`, op-id-derived remapping, or the rejection of producer-side pre-remapping means
this ADR.

> Implemented in the cmp `@comfyorg/comfy-multi-player` package via PR
> https://github.com/Comfy-Org/ComfyUI_frontend/pull/17501 (final blind review with zero findings:
> https://github.com/Comfy-Org/ComfyUI_frontend/pull/17501#pullrequestreview-5185868875). The
> governed-repo copy of this ADR is now present in the cmp package.

## Context

`insert_workflow` is V1 (Monday 2025-09-15, FE 1.54) scope per Christian's 2026-09-12 correction. The op
carries a whole workflow fragment (nodes, links, groups, nested subgraph definitions) whose IDs were
chosen by the producer (agent tool, comfy-cli, or a pasted template) with no knowledge of the target
document. Producer-chosen IDs collide with existing document IDs, and two followers that replay the
same op set in different legal orders must converge (KA-4) without ever merging Yjs documents
directly (KA-1).

Early iterations of the PR remapped IDs after validation, exposed a public counter-based
`remapWorkflowIds` helper, and validated raw IDs only at the top level of the fragment. Blind reviews
showed: exact duplicates returned collision codes instead of `malformed_op`; normalized duplicates
(`1` and `"1"`) and missing IDs inside nested definitions were accepted; dangling links inside nested
definitions were retained; sibling definitions reusing a nested raw ID were aliased to one derived
ID; and a higher-digest `define_subgraph` replacement dropped nested widget edits, so opposite orders
diverged.

## Decision

- Producers send raw IDs. cmp owns remapping. Every node, link, group, and definition ID in the
  fragment is remapped deterministically from the op envelope `id` (op-id-derived), so exact replay
  is byte-identical and independent inserts converge in either replay order.
- The remapper is internal to cmp and is not publicly exported. No producer-side or
  document-state-dependent allocator exists.
- Only `nodes` is required; `links`, `groups`, and `definitions` may be omitted.
- Raw-ID validation runs recursively before remapping, at every definition depth. Exact duplicates,
  normalized duplicates, and missing node or link IDs reject atomically with `malformed_op`, preserve
  the encoded bytes, and do not consume the op id.
- Dangling links (an endpoint outside the fragment or across a definition boundary) are dropped per
  link; the surviving node's `inputs[].link` and `outputs[].links` references are scrubbed and
  remapped so the projected definition is self-consistent.
- Nested definition IDs are scoped: the same raw nested ID in sibling scopes yields distinct derived
  IDs; a duplicate within one scope rejects. A remapped-definition collision anywhere in the stored
  tree returns `definition_conflict` byte-identically.
- When a higher-digest `define_subgraph` replaces an existing definition, root and nested widget
  edits are preserved so both legal orders project the same state.
- Private `__*` keys (including `__definition_digest`) are scrubbed recursively from projected
  content. Unknown UUID-shaped and non-UUID heads share the same no-op path.

## Consequences

- Agent tools and comfy-cli stay simple: they emit fragments with their own local IDs and never
  query document state before inserting.
- `set_widget` and other id-addressed ops can target nodes inside nested inserted definitions
  because definitions are stored addressably, not as opaque JSON.
- Rejections are atomic; a rejected insert leaves no partial definition writes.
- The frontend follower (https://github.com/Comfy-Org/ComfyUI_frontend/pull/17202) and the e2e
  spec (https://github.com/Comfy-Org/ComfyUI_frontend/pull/17585) currently exercise host
  materialization via `add_node`/`connect`; an `insert_workflow` e2e case is owed once the cmp
  package version carrying the op is pinned by the frontend.
- The README, `src/index.ts`, and `src/types.ts` now state eight frozen op kinds.

## Alternatives Considered

- Producer-side pre-remapping (producer reads the document and picks free IDs). Rejected:
  document-state-dependent, races between concurrent producers, and breaks opposite-order
  convergence.
- Public counter-based `remapWorkflowIds` export. Rejected per
  https://github.com/Comfy-Org/ComfyUI_frontend/pull/17501#discussion_r3995503934: exposes an
  allocator whose output depends on call order rather than the op envelope.
- Storing nested definitions as opaque JSON. Rejected: later id-addressed `set_widget` could not
  resolve nested nodes.

## References

- https://github.com/Comfy-Org/ComfyUI_frontend/pull/17501
- https://github.com/Comfy-Org/ComfyUI_frontend/pull/17501#pullrequestreview-5185868875
- https://github.com/Comfy-Org/ComfyUI_frontend/pull/17454 (V2 `define_subgraph`, base of #17501)
- `program/decision-log.md` (2026-09-12 entries)
- KA-1 (no direct Yjs merge), KA-4 (convergence) in `plans/archive/end-shape-roadmap.md`
