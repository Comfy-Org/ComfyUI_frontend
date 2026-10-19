# ADR-UI-OVERLAYS-0045: Order portals within one tier

Date: 2026-10-19

## Status

Proposed

## Context

Incrementing dialog z-indexes eventually puts dialogs above dropdowns that
use fixed values. Giving overlays equal z-indexes removes that mismatch, but
does not make Reka portals follow opening order. In Reka 2.11, Presence removes
closed content while Vue retains the Teleport anchors. Opening A, closing A,
opening B, and reopening A therefore leaves B above A.

## Decision

Use one design-system overlay tier and move an application-owned portal target
to the end of its destination when its overlay opens. Vue continues to own the
children and Teleport anchors inside that target. Reka continues to own focus,
dismissal, transitions, and whether closed content stays mounted.

Toast descendants inherit a destination inside the toast stacking context.
That destination sits outside the scrolling dock so dropdowns are not clipped.
An explicit destination overrides the inherited destination. A nested provider
must forward the other parent configuration because Reka providers do not merge.

Loading and reconnect screens block everything. Toasts and survey notifications
stay above ordinary overlays. Tours also have a fixed tier. Getting Started
stays below dialogs so its actions can open usable dialogs. The pre-Vue splash
keeps its independent bootstrap styling because the theme may not have loaded.

## Alternatives rejected

- Unmounting every portal on close interrupts exit animations and closed Select
  item registration. It also discards retained content.
- Rekeying a portal on open discards component state.
- Moving Vue-owned content outside its Teleport anchors breaks cleanup.
- Native dialogs and popovers provide browser-managed stacking, but replacing
  Reka's focus and dismissal behavior is a separate migration.

## Extension compatibility

Extension elements appended to the same destination follow CSS stacking rules.
At the shared overlay tier, later DOM siblings paint above earlier ones. A
higher explicit extension z-index wins; a lower one loses. Core no longer
increments a counter to overtake extension content. Extension overlays that
retain their DOM must move their own portal target on reopen if they need
last-opened ordering. Ancestor stacking contexts still constrain all of these
rules. Appending to body does not escape a stacking context inside another
portal destination.

Moving a portal preserves Vue component instances and input values. Browser
resources such as iframes can reload when their DOM ancestors move; keep such
notifications in a fixed tier when preserving the browser resource is required.
