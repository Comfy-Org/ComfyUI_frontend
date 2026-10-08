# ADR-EXTENSIONS-OWNED-UI-0032: Instance-bound Element Handles

Date: 2026-10-08

## Status

Proposed

## Context

Two instances of a node commonly use the same element names. A pack-wide name
lookup overwrites one instance with another and lets an old handle control a
replacement. Converted metadata viewers need image dimensions and textarea
caret/value operations without receiving host DOM objects.

## Decision

- Use `comfy.element(name, { nodeId, widget })` for an instance's mounted UI.
  Omit scope only for an unambiguous name; ambiguity is an error.
- Bind on first use to the exact mounted element. Retain that binding across
  updates; permanently revoke it on removal. Replacements need fresh handles.
- Return bounded scalar data and allowlisted operations, never a DOM object.
  `listen()` returns unsubscribe; owner removal also detaches subscriptions.
- Await asynchronous browser operations and propagate failures.
- Implement the same contract natively and through the optional secure overlay.
  The secure broker derives the pack from worker identity, not request fields.
- Feature probes describe implementation, not permission grants. A trusted
  native extension is still unsandboxed.

These operations affect transient UI state, not graph entities. Persistent
widget values continue through mounted value cells and existing serialization
and mutation commands. This adds no instance state to graph/node classes and
does not expose Vue dependencies to packs.

Alternatives rejected: pack-wide names (cross-instance collisions), resolving
an old handle by name on every call (silent retargeting), and returning raw DOM
(unbounded access and no worker implementation).

## Consequences

### Positive

- Authors can reuse one UI implementation for many node instances.
- Stale handles fail rather than modifying a different owner.
- Native and sandboxed conversions share call shapes and lifetime rules.

### Negative

- Ambiguous legacy calls must provide node/widget scope.
- Providers retain binding/subscription bookkeeping until owner removal.
- This does not certify the overlay's wider security profile or network policy.

## Notes

- [Published contract and bounds](../node-api/reference.md#pack-owned-state-and-elements)
- [Native behavior tests](../../src/platform/nodeApi/nativeOwnedElement.test.ts)
- The private provider additionally runs an opaque iframe/worker regression
  for two nodes, unsubscribe, removal/replacement and foreign binding denial.
