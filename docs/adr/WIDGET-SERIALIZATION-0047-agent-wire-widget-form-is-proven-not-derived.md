# ADR-WIDGET-SERIALIZATION-0047: The Agent wire's widget form is proven, not derived

Date: 2026-10-23

## Status

Proposed

## Context

A workflow stores widget **values** but not the **schema** needed to interpret
them. Three systems reconstruct that schema independently — this frontend from
its own registrations, `comfy-cli` from `object_info` plus a set of
hand-maintained guesses, the doc host from a pinned catalogue — and they drift.
`widgets_values_form` is the minimal self-describing step: it declares the
order the node's named widget values belong in, so the reader needs no
catalogue for that node.

That makes a form **authoritative**. `comfy-multi-player`'s
`widgetStorageFor` picks self-described storage whenever a form is present,
ahead of the catalogue; `projectWidgets` projects from the form with no
catalogue lookup; and `validateWidgetName` treats the form as closed. A node
that carries a wrong form is therefore worse off than a node that carries
none: there is no later leg at which the mistake can be caught.

The frontend emits the form at one place only, the Agent wire boundary
(`wireNodeSnapshot` in `src/workbench/extensions/agent/crdt/docOpMinter.ts`).
An ordinary save carries no form. That boundary was chosen deliberately: a
core-serialization producer was reviewed and rejected, because shared
serialization would then be compensating for one consumer's closed-form
interpretation.

### The claim this ADR exists to refute

The producer was originally justified by "the values and the order come out of
the same loop, so they cannot drift." That is false, and the falsifier is
specific. `LGraphNode.serializeFromStoreState` does:

```ts
Object.assign(o, serialiseWidgetValues(widgets)) // core writes both fields
// ...
runExtensionSerializeHook(this, o, NODE_CANONICAL_FIELDS, this.onSerialize)
```

`widgets_values` and `widgets_values_named` are both in
`NODE_CANONICAL_FIELDS`, so `runExtensionSerializeHook` copies an extension's
writes to either one back over what core produced. The hook runs **after**
core wrote the values, and a node's `onSerialize` can also mutate
`node.widgets` while it runs. So the values a form would describe can be
replaced, truncated or extended between the derivation and the wire — and in
exactly the population the hook exists for, third-party packs with custom
serializers. A check placed before the hook asserts the one thing that was
never in doubt.

`SubgraphNode.serializeFromStoreState` is the in-repo instance of the same
shape: it calls `super.serializeFromStoreState(state)`, which already includes
the hook, and then replaces `widgets_values` itself. "Post-hook" is necessary
and not sufficient — the base post-hook is not always the last writer.

## Decision

1. **The form is a proof, not a derivation.** The wire declares a form only
   where it can prove the declared order describes every named value the Agent
   wire carries. Positional compatibility data and extension-private values
   that the wire filters out are outside that claim. Where the order cannot be
   proven, the wire declares nothing. "Declare nothing" is the behaviour in
   every environment; see decision 4.
2. **Every check reads the post-hook payload.** The classifier takes the
   serialized node returned by `node.serialize()` — hook already run — and
   compares it against the live widget list, rather than inspecting state
   core holds before the hook.
3. **Four invariants, stated once and asserted at that one site.** They are
   the contract; the list below is the normative text and the assertion
   messages name the broken entry.
4. **Suppression is the gate; `assert` is the channel.** `assert` from
   `src/base/assert.ts` throws under DEV only, so it cannot be the mechanism
   that keeps a wrong form off the wire. Returning no form is. The DEV throw
   is deliberately swallowed at this seam, because every one of these
   invariants is breakable by a third-party pack: a pack must not be able to
   stop the Agent from minting in a developer's browser, only to be unable to
   make us publish a form describing the wrong values. The console line and
   the production reporter still fire.
5. **Invariant 4 is a signal, not a failure.** "Object-shaped values with no
   declared form" is the expected state for much of the ecosystem today. It
   reports rather than asserts, and it is the only way to learn _which_
   classes still declare nothing, which is what decides whether the form path
   generalises.

### The four invariants

Let _live_ be `node.widgets`, _value widgets_ be those whose values survive the
Agent wire filter, _values_ the name-keyed object the wire ships, and _order_
the declared sequence.

| #   | Invariant                                                                                                           | Reason slug                       |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | Every `order` entry names a live value widget.                                                                      | `order_names_unserialized_widget` |
| 2   | `order` and `Object.keys(values)` agree as a set difference in **both** directions.                                 | `declared_keys_disagree`          |
| 3   | The filtered post-hook named-value key set equals the live value-widget key set.                                    | `hook_changed_serialized_widgets` |
| 4   | Object-shaped values with no declared form are reported, once per class and reason, with 100 distinct keys maximum. | `agent_widget_form_undeclared`    |

Two of these need their exact form recorded, because the obvious version of
each is wrong:

- **Invariant 2 is bidirectional.** `order` ⊆ `keys(values)` alone misses
  residue — a stored value outside the order, which the host would keep and
  never project. The VideoHelperSuite shape is the in-ecosystem instance: it
  keys its dict from the _unfiltered_ widget list, so its keys and a derived
  order differ by exactly the one widget carrying `serialize = false`.
- **Invariant 3 compares key sets, not key sequences.** Key order inside
  `widgets_values_named` is not meaningful — an integer-like widget name is
  enumeration-reordered by the object itself, which is the reason the form
  exists. A pack that reorders keys and changes nothing else has not broken
  anything.

### Shapes that are suppressed without being violations

A value-dependent layout (`COMFY_AUTOGROW_V3`, `COMFY_DYNAMICCOMBO_V3`,
`COMFY_DYNAMICGROUP_V3`) keeps its order in the catalogue, which expands it
with the selection; a closed form would freeze it. A missing-node shell
(`last_serialization` set) round-trips a stored payload for a class this build
cannot see, so its live widget list — empty or fabricated — cannot order it. A
value with no live widget at all, an unnamed widget, and two value widgets
sharing a name are all shapes a correct producer cannot describe. These report
under invariant 4 with their own reason and never assert.

A node whose only widgets are buttons is the one suppression that is **not**
reported: it has no named value for a form to order, so counting it as a
declaration gap would bury the signal under every such class in the ecosystem.

## Consequences

- One behaviour change relative to the previous derivation: a node whose
  filtered post-hook named-value key set was rewritten by an extension no
  longer gets a form. Positional or private state the Agent wire does not send
  does not suppress the form.
- Invariant 4 turns "what fraction of the ecosystem declares a form" from an
  unanswerable question into a queryable one: `error_type`
  `agent_widget_form_undeclared`, tagged `node_type` and `reason`,
  fingerprinted on all three, one report per class and reason per page session.
- A bulk pass does not go through telemetry at all.
  `widgetValuesFormVerdict(node)` runs the node's serialization hook, classifies
  and tallies the result, and `widgetFormSuppressionTally()` returns up to 100
  distinct per-class counts. The hook can mutate extension state, so the corpus
  runner must use disposable nodes. A thrown hook is classified separately as
  `serialization_failed`.
- The frontend follower has no read-back handling for the form, so the round
  trip remains the host's. That is unchanged by this ADR and is why the form
  stays on the Agent wire rather than in ordinary saves.

## Alternatives considered

**Emit the form from core serialization.** Rejected on review: it puts a
consumer's closed-form interpretation into shared serialization, and it needs a
core policy suppressing forms for dynamic combos, groups and autogrow to
compensate. The Agent adapter is the smallest boundary that owns the decision.

**A stable per-widget UUID instead of an order.** Right idea, wrong boundary.
ECS ids are process-local and minted at graph join, while workflow JSON is
durable, portable and cross-tool: a random id means nothing to a reader that
did not mint it, a derived one is only as stable as what it derives from, and
persisting the mapping re-invents the form plus a layer no human can read in a
diff. `(name, occurrence)` was already rejected for adding a second
widget-identity format; a hash would be a third.

**Assert and keep emitting.** Rejected. A wrong form is authoritative on every
leg, so the only safe response to an unproven form is not to send one.

**Throw under DEV.** Rejected for this seam specifically; see decision 4. The
unit suite is what pins each invariant, including that each one still fires.
