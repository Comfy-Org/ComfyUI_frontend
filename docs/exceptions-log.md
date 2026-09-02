# Repository exceptions and compatibility contracts

This file records two kinds of deliberate departures from the repository's
normal architecture rules:

- Temporary exceptions describe a known transitional state and how to end it.
- Compatibility contracts preserve a specific behavior for external consumers.

## Rules

A temporary exception must name its scope, owner, opening date, closing
condition, and decision record. When it closes, move it to the closed section
and add the closing date and change that closed it.

An entry applies only to the scope it names. Expanding that scope requires a
new decision. A pull request that introduces another exception must add or
reference an entry here.

Compatibility contracts do not need a closing date. Changing one requires a
superseding decision.

## Open exceptions

### EX-001: Slot metadata remains class-owned during migration

**Normal rule:** Stores own entity state. Classes and boundary objects expose
views of that state.

**Current exception:** `NodeState` holds `NodeInputSlot` and `NodeOutputSlot`
instances in `shallowReactive` arrays. `LGraphNode.inputs` and
`LGraphNode.outputs` expose those arrays through the store proxy. The array
containers are store-held, but slot fields remain on the class instances.

**Owner:** Christian Byrne

**Opened:** 2026-08-24

**Closes when:** ID-keyed store records own slot state and both interim
representations have been removed: the class-instance arrays and any descriptor
or Proxy compatibility layer. Once a field moves into a store record, no class
or projection may become a separate source of truth for it.

**Decision:** [ADR-SLOTS](adr/SLOTS-slot-records-as-the-source-of-truth.md)

### EX-002: Store collision behavior is not yet documented and tested

**Normal rule:** Tests and ADRs document behavioral contracts before other code
relies on them.

**Current exception:** `nodeDataStore`, `linkStore`, and `rerouteStore` reject
identity-key collisions so the caller can mint a new ID. `widgetValueStore`
resolves structural-key collisions. The behavior exists in code, but the ADR
collision table is outdated and no shared test suite covers all four stores.

**Owner:** Christian Byrne

**Opened:** 2026-08-24

**Closes when:** PRs #15720 and #15761 land with the corrected ADR text and
`src/stores/storeCollisionContracts.test.ts` covers all four stores. Issue
#15743 tracks the work.

**Decision:** PRs #15720 and #15761

## Compatibility contracts

### EX-003: `LLink` preserves seven enumerable topology properties

`LLink` keeps these own enumerable properties for consumers that copy links
with object spread:

- `id`
- `type`
- `origin_id`
- `origin_slot`
- `target_id`
- `target_slot`
- `parentId`

They are forwarding descriptors. Reads and writes still use the store-backed
`LLink._state`; the instance does not keep synchronized copies.

This contract covers no other `LLink` properties and no other entity types.
Changing it requires a superseding decision based on the published extension
policy, a concrete invariant violation, or measured consumer requirements.

**Owner:** Christian Byrne

**Recorded:** 2026-08-24

**Decision:** PR #15654. PR #15778 contains the original patch and discussion.

## Closed exceptions

_None yet._
