# ADR-CANVAS-0053: Stable stack-head targets

Date: 2026-11-17

## Status

Accepted

## Context

A hidden-link stack expands on a single click and opens Rename on a double
click. Its collapsed head includes decorative layers. Removing those layers
during expansion previously shrank its hit area, so a second click at the
same point could target an individual member instead of the stack.

Restoring the expansion state from before a double-click required remembering
which first click toggled which stack. That introduced stack-specific gesture
history alongside the canvas pointer reducer, with additional invalidation and
release-cleanup rules. Immediate expansion also caused a visible flash before
Rename opened.

## Decision

Keep each stack head's collapsed collision and hit extent in both expansion
states. Decorative layers may disappear, but the head retains its target and
members avoid that target during layout.

Use ordinary canvas click and double-click dispatch. Delay expansion through
the double-click window, but collapse an expanded stack immediately. A second
press on the same head cancels pending expansion, including while that press
is held. Opening Rename cancels all pending expansion on that canvas, whether
Rename starts through a double-click or a menu.

Submitting Rename collapses the renamed stack and any stack it merges into.
Cancelling Rename does not change expansion. Rename does not restore the
expansion state from before the gesture or retarget a second press outside
the head.

Escape, an empty-canvas click, canvas clear, graph replacement, and event
unbinding cancel pending expansion. Escape still permits an already pending
Rename callback to run. Editing-mode guards still apply when that callback
runs. Ordinary redraws do not cancel pending expansion.

## Alternatives

Immediate expansion avoids input latency but flashes individual members before
Rename opens. Delaying expansion accepts a short pause to avoid that flash.

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
