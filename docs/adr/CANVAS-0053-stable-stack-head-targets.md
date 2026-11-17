# ADR-CANVAS-0053: Stable stack-head targets

Date: 2026-11-17

## Status

Accepted

## Context

A hidden-link stack expands or collapses immediately on a single click. Its
collapsed head includes decorative layers. Removing those layers during
expansion previously shrank its hit area, so a second click at the same point
could target an individual member instead of the stack.

Restoring the expansion state from before a double-click required remembering
which first click toggled which stack. That introduced stack-specific gesture
history alongside the canvas pointer reducer, with additional invalidation and
release-cleanup rules.

## Decision

Keep each stack head's collapsed collision and hit extent in both expansion
states. Decorative layers may disappear, but the head retains its target and
members avoid that target during layout.

Use ordinary canvas click and double-click dispatch. A click toggles expansion;
a double-click opens Rename for the stack under the second press. Submitting
Rename collapses that stack. Cancelling leaves the first click's toggle in
effect. Rename does not restore the expansion state from before the gesture
or retarget a second press outside the head.

Escape retains ordinary canvas behavior: it collapses stacks without implicitly
cancelling the pending Rename callback. Editing-mode guards still apply when
the callback runs.

## Alternatives

A delayed single-click action avoids toggling before Rename but adds input
latency and ownership of pending work through cancellation and graph changes.

A separate expansion control would let label double-click Rename preserve
expansion without gesture history. It changes the interaction target and needs
a distinct accessible affordance. We retain whole-pill expansion instead.

A remembered first-click target preserves the old expansion state and permits
second-click drift outside the head, but requires the temporal coordination
this decision removes.

## Consequences

Expanded heads reserve a small unpainted margin, and members may move farther
from the head. This guarantee concerns the clicked head under otherwise
unchanged layout inputs; expanding an earlier stack may still move later
stacks. Expansion remains transient view state, separate from the undoable
batch label mutation.
