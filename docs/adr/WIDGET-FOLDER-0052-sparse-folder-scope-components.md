# ADR-WIDGET-FOLDER-0052: Sparse Folder Scope Components

Date: 2026-11-03

## Status

Accepted

## Context

A combo folder lock constrains browsing, search, and stepping without changing
the widget's value or backend options. Users expect that boundary to survive
workflow saves. Most widgets never need a folder lock.

## Decision

Represent a lock as plain directory data in a sparse component map keyed by
canonical widget identity. Absence means unlocked. Do not add folder-specific
fields, callbacks, or accessors to widget instances or their render projections.
Use the existing widget lifecycle for renaming, retention for undo, and removal.

A promoted host input owns its scope independently of the interior input. Sharing
the source's options and value does not imply sharing the user's browsing scope.

Translate between components and per-input workflow metadata at serialization
and restoration boundaries. Detached nodes carry that metadata until attachment
assigns their identity, so copies do not retain the original widget's identity.

## Alternatives

Popover-local state loses the boundary on reload. A source-widget adapter couples
presentation preferences across promoted inputs and puts concern-specific behavior
on a general widget interface. A separate folder-lock lifecycle would duplicate
the widget lifecycle without providing a different ownership boundary.

## Consequences

Ordinary widgets allocate no folder component. Workflow metadata remains readable
by this feature and ignorable by older renderers. Folder scope is a presentation
constraint, not a mutation of the execution options or a control-after-generate
filter.
