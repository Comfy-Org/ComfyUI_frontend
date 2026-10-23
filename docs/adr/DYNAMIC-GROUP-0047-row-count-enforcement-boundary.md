# ADR-DYNAMIC-GROUP-0047: Row Count Enforcement Boundary

Date: 2026-10-23

## Status

Proposed

## Context

A DynamicGroup input declares `min` and `max` row bounds in Core's node schema
(`_DynamicGroup` in `comfy_api/latest/_io.py`). The value has one source, but
five layers were each checking a row count against a different bound, and
nothing written down said which layer owned which check:

| Layer                                                                                             | Bound it applied                                                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Core                                                                                              | rejects a prompt with rows outside `min..max` at execution                                            |
| comfy-cli (`_write_dynamic_group_count`)                                                          | refuses to write a count outside `min..max`                                                           |
| Frontend local UI                                                                                 | disables adding a row at `max`; the setter does not clamp, so a saved workflow keeps rows above `max` |
| comfy-multi-player ([#276](https://github.com/Comfy-Org/comfy-multi-player/pull/276), unreleased) | ignores `max` on purpose; checks `min` and `MAX_OVERFLOW_WIDGETS / fields per row`                    |
| Frontend remote apply ([#21264](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21264))        | refused a count above `max(max, current rows, rows the document carries values for)`                  |

The last row is the defect. It is neither a policy check nor an allocation
bound but a hybrid of both, and because a follower applying it is stricter than
the document layer that fed it, the document and the canvas can disagree about
how many rows a group has. [#21288](https://github.com/Comfy-Org/ComfyUI_frontend/issues/21288)
records the reachable case: once #276 ships, the doc host accepts a bare count
of 25 on a `max: 20` group and the frontend refuses it, because the document
carries no values for the new rows.

Two further consequences of that hybrid ceiling were measured while writing
this ADR, neither recorded on the issue:

- The ceiling's documented-rows term reads named widget maps only, so a group
  stored as an opaque positional array, restored above `max`, shrunk locally,
  then regrown by a rollback or a peer's undo is refused the regrow.
- **The ceiling was not the only `max` check on the remote path.** The applier
  creates a remote node with `node.configure(info)`, whose restore path runs
  the controller setter, whose `validateSavedRowCount` also refused above
  `Math.max(max, savedValueCount)` — by throwing, which collapsed the group to
  zero rows. A bare above-`max` count from a document was therefore refused
  twice, in two layers, and fixing only the applier would not have fixed the
  divergence for remotely created nodes.

comfy-multi-player #276's own documentation already states half of the rule
this ADR completes: _"The catalog controls layout, not prompt validity. Saved
rows above an advertised `max` are retained; CLI/core validation decides
whether they can execute."_ It also explains why `min` is refused rather than
clamped at the document layer — the frontend raises a count up to `min`, so
accepting a lower one would leave the document and the canvas disagreeing.
That is a convergence requirement, not a policy choice, and the same reasoning
applied at the ceiling is what produced this ADR.

## Decision

Enforcement splits by role, not by layer. One value source, three jobs:

- **Core owns executability.** `min..max` decides whether a workflow can run.
  It is the only authority on prompt validity and the only place the product
  rule is ratified.
- **Producers keep authored counts inside `min..max`.** comfy-cli's writer and
  the frontend's local UI are producers: the add button stops at `max` and is
  disabled there. A producer may be as strict as the policy, because it is
  creating the content.
- **Transports and followers preserve the count the document carries and bound
  only allocation.** comfy-multi-player and the frontend's remote-apply path
  are in this role. They do not read `max`. They refuse a count only when
  materialising it would allocate unbounded widgets, and that refusal is a
  safety bound every layer may hold independently — it is not a policy
  decision and carries no product meaning.

Concretely in this repository:

1. `LiveGraphApplier.applyDynamicGroupRowCount` no longer consults `max`,
   the live row count, or the document's row keys. It writes the document's
   count through the controller setter and reports a mismatch if the live
   group did not reach it. `documentedRowCount` is deleted.
2. The allocation bound moves into the controller's setter in
   `dynamicGroupWidget.ts`, which is the one semantic path every writer
   funnels through — a restored file, the local UI, a peer, the agent. It is
   `MAX_DYNAMIC_GROUP_ROW_WIDGETS / fields per row`, mirroring
   comfy-multi-player's `MAX_OVERFLOW_WIDGETS`, and **must not be lower than
   it**: a follower stricter than the document layer recreates the divergence
   this ADR removes. `dynamicGroupEnforcementBoundary.test.ts` pins the
   relation against the package's exported constant.
3. `validateSavedRowCount` is declared an authoring/restore guard and does not
   run against a followed document. Its `max` term is therefore no longer
   reachable from remote apply. It keeps its existing local behaviour, including
   its throw, because a saved count the file cannot account for is a corrupt
   file rather than a count a peer asked for.

The bound is held per-group rather than globally because a row's cost is its
field count: the controller records how many fields its template declares when
it is registered, and the bound is derived from that.

## Alternatives considered

**Clamp the remote count to `max` instead of refusing it.** Rejected for the
reason #276 gives for refusing counts below `min`: a follower that silently
changes the count leaves the document and the canvas disagreeing, with no event
that says so. Preserve or refuse-and-report, never quietly adjust.

**Keep `max` in the follower and make the document layer enforce it too.** This
would converge the two layers, but it puts a product policy in a transport and
makes `max` unchangeable without a coordinated release across Core, the CLI, the
package, the doc host and the frontend. It also contradicts the retained-rows
behaviour users already rely on, since a workflow saved above `max` loads today.

**Import `MAX_OVERFLOW_WIDGETS` directly into the shared widget.** Rejected to
keep `src/core/graph/widgets/` free of a dependency on the CRDT package: the
frontend's budget is about frontend widget and input allocation, and the package
documents its own constant as "the package-level floor under every caller, not a
replacement for it". The relation is asserted in a test instead of assumed by an
import, which is what catches a future drift.

**Leave the applier ceiling and fix only `validateSavedRowCount`.** Rejected:
both paths refuse, so either alone leaves the divergence reachable.

## Consequences

### Positive

- A count the document layer accepted is applied by the follower, so the
  document and the canvas cannot disagree about a group's row count.
- `max` has one enforcement story. Changing the product rule is a Core and
  producer change; no transport has to be re-released to follow it.
- The applier gets smaller: a three-term hybrid ceiling and a helper are
  deleted, and the remaining code states the follower's whole job.
- Allocation safety is now held on the path every writer takes rather than only
  on the one path the applier walks, which closes the `node.configure` hole.
- The opaque-positional-array regrow case in #21288's second comment is fixed
  as a side effect, because no term reads the document's row keys any more.

### Negative

- A group can now hold more rows than `max` on the canvas when a document says
  so, and the user sees that only when execution fails Core's validation. This
  is already true for saved workflows; this ADR makes it uniform rather than
  introducing it. A clearer in-canvas signal for an unexecutable row count is
  worth having and is not part of this change.
- The frontend's bound is a second constant that must track the package's. The
  pinning test makes a drift loud, but it is still duplication.
- Three of the frontend's existing assertions encoded the old boundary and were
  rewritten. They asserted where enforcement happened, which is exactly what
  moved; the user-visible refusal of an unbounded count is still asserted.

## Notes

`max` enforcement in a transport would have been agent policy in a shared layer
had it been written as a flag or a trailing context parameter on the shared
widget. It was not: provenance reaches the shared layer only as
`applyRemoteDynamicGroupRowCount`, which brackets the call for the duration of
the write, and `isRemoteDynamicGroupRowWrite` reads that bracket. That is
call-scoped provenance and the mechanism predates this change.

Related issues decided elsewhere, deliberately not settled here:
[#21091](https://github.com/Comfy-Org/ComfyUI_frontend/issues/21091) (a new
row's defaults overwriting a peer's edit) and
[#21092](https://github.com/Comfy-Org/ComfyUI_frontend/issues/21092) (removed
tail rows leaving keys in the document) both come from #276's hidden-row model
and belong to the retained-keys-versus-delete-operation decision. This ADR
removes the frontend ceiling that read those leftover keys, which is why
`documentedRowCount` no longer exists, but it does not rule on the row model
itself.
