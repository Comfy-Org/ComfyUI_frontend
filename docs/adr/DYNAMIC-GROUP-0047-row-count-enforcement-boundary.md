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
- **Transports and followers preserve the count the document carries within
  their own resource bounds.** comfy-multi-player and the frontend's
  remote-apply path are in this role. They do not read `max`. They refuse a
  count only when materialising it would cross a safety bound that layer can
  evaluate; those bounds need not be identical because the document package
  counts serialized fields while the frontend allocates widgets and inputs.

Concretely in this repository:

1. `LiveGraphApplier.applyDynamicGroupRowCount` no longer consults `max`,
   the live row count, or the document's row keys. It writes the document's
   count through the controller setter and reports a mismatch if the live
   group did not reach it. `documentedRowCount` is deleted.
2. The allocation bound moves into the controller's setter in
   `dynamicGroupWidget.ts`, which is the one semantic path every writer
   funnels through — a restored file, the local UI, a peer, the agent. The
   frontend allows at most 256 rows and derives a lower per-group ceiling from
   a 4096-resource budget. Each row is charged for its header plus, per field,
   one input, one primary widget and one possible built-in auxiliary widget.
   The hard row ceiling also bounds the existing quadratic row-layout work.
3. The saved-value-count heuristic is removed; the allocation bound replaces
   its only safety role without treating a missing serialized row value as a
   `max` policy violation. Every remote `node.configure` call as well as the
   ordinary widget-write path carries node-scoped remote provenance. A count
   beyond the allocation bound aborts configuration rather than allowing
   positional restoration to continue over missing row widgets; an ordinary
   remote write is rejected before callbacks or graph-version changes occur.

The bound is held per-group because a row's cost depends on its template. The
controller records the template field count when it is registered. Custom
widget constructors are trusted local code and can allocate more than the
built-in estimate, but the 256-row ceiling still bounds remote amplification.

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

**Reuse `MAX_OVERFLOW_WIDGETS` as the frontend limit.** Rejected because the
package counts serialized field entries while the frontend allocates row
headers, inputs, primary widgets, auxiliary widgets, and repeatedly rebuilds
input layout. The cross-boundary test compares the derived limits explicitly
so a future change cannot silently pretend that both budgets measure the same
resource.

**Leave the applier ceiling and fix only `validateSavedRowCount`.** Rejected:
both paths refuse, so either alone leaves the divergence reachable.

## Consequences

### Positive

- Above-`max` counts used by retained workflows are applied uniformly on named,
  positional, DynamicCombo, and ordinary widget-write paths.
- `max` has one enforcement story. Changing the product rule is a Core and
  producer change; no transport has to be re-released to follow it.
- The applier gets smaller: a three-term hybrid ceiling and a helper are
  deleted, and the remaining code states the follower's whole job.
- Allocation safety is held on the path every writer takes, and remote
  configuration is provenance-bracketed, which closes the `node.configure`
  hole without allowing a rejected positional restore to continue.
- The opaque-positional-array regrow case in #21288's second comment is fixed
  as a side effect, because no term reads the document's row keys any more.

### Negative

- A group can now hold more rows than `max` on the canvas when a document says
  so, and the user sees that only when execution fails Core's validation. This
  is already true for saved workflows; this ADR makes it uniform rather than
  introducing it. A clearer in-canvas signal for an unexecutable row count is
  worth having and is not part of this change.
- A document count above the frontend's resource ceiling is refused even if the
  document package accepted it. That explicit, reported safety mismatch is
  preferable to freezing the tab or silently misaligning positional values.
- Three of the frontend's existing assertions encoded the old boundary and were
  rewritten. They asserted where enforcement happened, which is exactly what
  moved; the user-visible refusal of an unbounded count is still asserted.

## Notes

`max` enforcement in a transport would have been agent policy in a shared layer
had it been written as a flag or a trailing context parameter on the shared
widget. It was not: provenance reaches the shared layer only as
`applyRemoteDynamicGroupRowCount`, which brackets both configure and ordinary
widget writes for the duration of the call, and
`isRemoteDynamicGroupRowWrite` reads that bracket. That is call-scoped
provenance and the mechanism predates this change.

Related issues decided elsewhere, deliberately not settled here:
[#21091](https://github.com/Comfy-Org/ComfyUI_frontend/issues/21091) (a new
row's defaults overwriting a peer's edit) and
[#21092](https://github.com/Comfy-Org/ComfyUI_frontend/issues/21092) (removed
tail rows leaving keys in the document) both come from #276's hidden-row model
and belong to the retained-keys-versus-delete-operation decision. This ADR
removes the frontend ceiling that read those leftover keys, which is why
`documentedRowCount` no longer exists, but it does not rule on the row model
itself.
