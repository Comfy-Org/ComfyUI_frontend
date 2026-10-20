# ADR-UI-LAYERS-0045: Owned stacking contexts

Date: 2026-10-20

## Status

Accepted

## Context

Increasing a popup's z-index can put it above a newer dialog, a toast, or even
the loading screen. A single global counter also couples unrelated owners.
Equal z-indices alone do not solve reopening: persistent Vue Teleport anchors
retain their original position when their content closes and opens again.

## Decision

Use named layers for ordering between surfaces. Keep workspace chrome in an
isolated workspace stacking context. Dialogs, the help center, and the toast
dock own separate stacking contexts and provide their descendant portal target
through Reka's configuration. Targets must sit outside transformed, animated,
or scrolling content; otherwise fixed-position descendants can move or clip.

Within each owner, prefer DOM paint order to z-index classes. Isolate canvas
rendering from the later workspace controls, and isolate image planes from
the later mask-editor controls. Dialog scrims precede content; canvas-control
scrims precede their menus. These descendants do not need application layers.
Shared popup primitives retain an overlay layer because they also portal to
the document without an owner. Local offsets remain only where the required
paint order differs from DOM order.

Getting Started covers the workspace but yields to dialogs. Tours sit above
ordinary overlays; toast owners and their descendants sit above tours. The
application loading blocker covers all of them. Do not collapse these roles
into one overlay layer.

Use DOM insertion order for peers in the same layer. Preserve keyed popup
portal lifetimes and mount dialog portals when opened so reopening moves the
owner after existing peers. Select portals remain mounted because option
registration depends on their closed lifecycle. Nested overlays use their
owner's target rather than escaping to the document to win a global contest.

Small numeric offsets remain available for local composition, such as image
planes, loading covers, and resize handles. They are not application layers.
Lint rejects arbitrary z-index utilities and large numeric utilities in frontend
classes, including variants and class-composition helpers.

## Alternatives

- A global z-index allocator handles some reopen cases but lets descendants
  escape their owner's order and requires lifecycle bookkeeping.
- Renaming every local offset into an application token makes unrelated image
  planes and controls appear globally comparable. Isolation is the boundary;
  token names alone cannot provide it.
- Renumbering document-level layers would change ordering against
  extension-owned UI. Keep their existing values, but remove workspace-wide
  tiers that isolation makes unnecessary. Document-level node previews share
  the nonmodal panel layer. Legacy imperative extension menus and the pre-Vue
  splash loader retain their independent contracts.

## Consequences

Opening a descendant cannot raise its owner above a newer peer. Adding a new
application layer requires deciding its relationship to onboarding, dialogs,
toasts, and blocking UI instead of choosing a larger number. Browser hit tests
must cover reopening, nested menus, and toast actions; DOM visibility assertions
cannot establish paint or pointer order.
