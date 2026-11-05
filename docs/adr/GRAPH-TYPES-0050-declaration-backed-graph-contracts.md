# ADR-GRAPH-TYPES-0050: Declaration-backed graph contracts

Date: 2026-10-27

## Status

Accepted

## Context

Workflow validation and settings need graph data contracts without importing
the graph editor. Widget contracts also refer to renderer-owned value types
and concrete pointer and rectangle classes. Moving their implementations
would bring editor behavior into a shared contract package.

## Decision

Keep graph contracts in a declaration-backed leaf package. Widget values belong
to that package rather than to the renderer that edits them. Runtime identity
helpers, enums, symbols, and workflow validation move with their contracts so
consumers retain one implementation and the same values.

Retain the exact-entity registry approach from ADR-TYPES-LITEGRAPH-0044.
Pointer and rectangle implementations bind their types through augmentation,
without moving their runtime code. Unbound registry aliases use persisted data
types where standalone serialization requires them. Editor-only bindings remain
uninhabitable until their provider is loaded.

The extension declaration build includes the contract sources and resolves
registry bindings to concrete provider types before bundling. Extensions must
not depend on the private graph contract package or supply augmentations.

## Alternatives

Structural copies of pointer and rectangle APIs would duplicate their contracts
and lose nominal compatibility. Importing the implementations from the package
would reverse the intended dependency. Keeping app-local forwarding modules
would preserve obsolete ownership and let new consumers bypass the package.
