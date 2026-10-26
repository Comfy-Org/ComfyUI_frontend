# Connection policies

`setConnectionPolicy()` declares constraints the host can check before wiring a
new link. It does not call extension code during the decision. This is a native
preview facility; worker registration remains unsupported until the host
supplies an explicit ownership or graph-tool authority check.

While an `ExtensionHostProvider` is installed, `setConnectionPolicy()` returns
`false`, definitions containing `connectionPolicy` throw before registration,
and existing native policies are suspended. Removing the provider resumes the
previous policies. This host-wide guard also covers bridges that forward
builder method names or definition fields without an explicit allowlist.

```typescript
comfy.defs.extend('Image Gate', (definition) => {
  definition.setConnectionPolicy({
    refuseCycles: true,
    refuseDuplicateSources: true,
    rules: [
      {
        side: 'output',
        slots: ['image'],
        peerTypes: ['Image Consumer'],
        peerSlots: ['image'],
        requiresConnectedInputs: ['image'],
        allow: 'only'
      }
    ]
  })
})
```

Each extension has one policy. A valid replacement copies the complete value
and returns `true`. Invalid data returns `false` and leaves its last valid
policy intact. `null` clears it. Extension disposal removes its effect; a
captured builder cannot reactivate a disposed extension. Policy data is not
saved in workflow JSON.

An invalid `NodeDefinition.connectionPolicy` throws before registering the
type or its hooks.

Rules apply to the selected side and slots. Omitted `slots` means every slot on
that side. `allow: 'only'` requires all supplied peer conditions to match;
`allow: 'never'` refuses when they all match. Peer types match the direct peer's
exact node type. A graph input/output boundary has no node type, so it matches
only rules that omit `peerTypes`. Existing host type checks still apply.

Use the existing `SlotRef` forms: slot ID or name, or explicit `{ index: 0 }`.
Names must resolve uniquely. Missing or ambiguous references refuse the attempt.
IDs follow slot reordering; positional references follow the new position.
All node and slot identities are resolved in the actual owning graph. Policies
never walk into its parent graph, child graphs, or another open workflow.

`requiresConnectedInputs` requires every named input on this node to be wired.
It reads current host topology. `whileDownstream` enables a rule only while a
node with one of the listed exact types is reachable downstream through the
declared `passThroughTypes`. The endpoint at which traversal stops is included
in that search.

`refuseCycles` refuses a link when its peer is already reachable from this
node's opposite side. Without `passThroughTypes`, cycle detection follows all
ordinary nodes. With that field, it continues only through the listed exact
types. An empty list checks direct peers only. `refuseDuplicateSources` checks
other inputs, permits reconnecting the same input, and follows declared transit
types upstream to compare source identities. Without transit types it compares
direct source nodes. Each graph boundary input is its own source.

Policies combine by refusal: either endpoint's policy or a native
`onBeforeConnect` returning `false` prevents the link. Replacement of an existing
input occurs only after these checks pass. Existing links are unaffected by
policy replacement. Workflow loading and authoritative command replay bypass
local policies; the existing callback behavior remains unchanged.

Declarations allow at most 16 rules, 8 transit types, and 32 entries in each
rule selector. Text entries contain 1–128 characters, explicit indices are
integers from 0 through 65,535, and unknown fields are rejected. The host limits
each endpoint policy evaluation to 4,096 node, slot, and edge inspection steps.
If that budget is exhausted, the attempted link is refused and existing links
remain in place.
