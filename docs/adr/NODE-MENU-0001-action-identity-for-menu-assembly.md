# ADR-NODE-MENU-0001: Action identity for menu assembly

Date: 2026-11-15

## Status

Accepted

## Context

Translated labels cannot identify actions. Extensions can also use the same
labels as built-in actions, so label-based replacement can discard unrelated
extension behavior. The Vue node menu still collects legacy callbacks because
extensions and native canvas consumers depend on those hooks.

## Decision

Identify built-in actions independently of their labels. One ordered section
definition determines placement and the available core identities. Vue actions
replace legacy actions only by identity. Unidentified extension actions retain
their order and remain distinct, even when their labels match.

Associate legacy identities with callbacks without changing extension-facing
menu objects. A suppressed callback remains available to native menus. Widget
identities include their graph, node, widget, and action to prevent replacement
across unrelated widgets.

## Alternatives and consequences

Directly assembling Vue sections would remove the classification step but
require migrating legacy-only actions and their availability rules at the same
time. Retaining the adapter limits that behavioral change. A mandatory extension
registration API would break existing producers and is unnecessary for core
replacement.

Callback identity survives label translation. If an extension wraps a core
callback, the wrapper remains extension-owned behavior. Separate legacy hook
comparison and dynamic submenu capture remain outside this decision.
