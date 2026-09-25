# ADR-AGENT-TARGET-0037: Commit Workflow Target on Explicit User Intent

Date: 2026-09-24

## Status

Proposed

## Context

Requiring a workflow selection before starting a chat adds a choice when the
visible editor already supplies a reasonable default. Permanently following
that editor would instead redirect subsequent messages, retries or graph-local
node references when the user browses another tab.

Server admission is not the user's decision boundary. A rejected first request
has already expressed a target, even though it has no server thread ID. The
panel can also unmount while the request is pending or after it fails.

## Decision

A fresh chat follows the visible workflow until the user successfully chooses a
target in the picker, submits a message, or adds node references. These actions
retain the target before further tab navigation, including a picker choice of
the already-visible workflow. Send retains before asynchronous preparation;
a picker retains only after successful selection. Failed, cancelled or
superseded picker operations do not commit. Success, failure, retry and removing
references do not resume following. Explicit target selection remains available; New Chat starts
following again unless its retained draft still contains node references.

The panel store owns this policy alongside target selection so it survives
component remounts. Startup resolves fresh versus restored context before
adopting a default. History selection retains its own restoration path; missing
or failed history does not become fresh simply because its thread ID is absent.

Passive following adopts the visible workflow without invoking the explicit
picker's save/navigation operation. Request origin, graph drafts, workflow
references and CRDT bindings keep their existing owners. Contextual feedback
takes priority over the educational tip and is independent of its dismissal.

We rejected waiting for successful server acceptance: resuming following after
a failed send would redirect the recovered draft. We also rejected continuing
to follow after nodes were referenced: clearing their chips loses user input,
while preserving invalid chips adds unnecessary repair steps when the original
workflow is already known. Ordinary draft text does not commit a target.

## Consequences

### Positive

- Fresh chat entry and New Chat use the same default without an extra save.
- Explicit choices, failed sends and node references preserve the target.
- Mismatch feedback can reveal a different target without changing it.

### Negative

- A chat with no accepted messages can still have a retained target; transcript
  length and thread ID cannot replace the explicit policy.
- Existing tests that treat manual first selection as mandatory must instead
  distinguish fresh following from a target committed by user input.
- Explicit retargeting keeps the existing node-scope cleanup behavior; this
  decision only changes passive tab following.

### Analytics

Passive defaults do not emit synthetic picker bindings. Their acknowledged
bindings remain `active_tab` or `minted`; explicit picker transitions retain
`selector_chip` attribution. Removing mandatory picker interaction will reduce
the selector-source share; this is an expected change in the interaction mix.
