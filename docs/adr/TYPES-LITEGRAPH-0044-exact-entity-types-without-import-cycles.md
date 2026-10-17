# ADR-TYPES-LITEGRAPH-0044: Exact entity types without import cycles

Date: 2026-10-11

## Status

Proposed

## Context

Litegraph's runtime imports are acyclic, but its public types are mutually
recursive. A node refers to its graph, and a graph refers to its nodes.
Importing these types from their implementation modules recreates the module
cycles. Replacing a concrete class with a public-member-only interface is not
compatible: TypeScript uses private and protected members when checking class
assignability, and extensions subclass these classes.

## Decision

Use same-name interfaces in `types/entityRegistry.ts`. Each implementation
augments its interface to extend the exact concrete type through a local alias.
Keep union, tuple, and primitive aliases in the merged
`LitegraphEntityRegistry` interface because an interface cannot preserve those
shapes by extending them. Existing public exports retain their names.

This removes module-import cycles, not recursive type relationships or runtime
coupling. It does not add entity members, change layout mutation ownership, or
replace the dedicated stores required by ADR-ECS-0008 and ADR-CRDT-LAYOUT-0003.
All type providers must remain reachable from the public litegraph barrel's
TypeScript import graph. Runtime providers must remain statically reachable
from `main.ts` without type-only or dynamic-import edges.

API Extractor does not reliably preserve local module augmentations. The types
build converts the leaf declarations into type re-exports of each provider's
exact alias, exports those aliases, and removes the internal augmentations
before bundling. The build derives the mapping from the source augmentations
rather than maintaining a second registry. The published package contains
ordinary declarations and does not require consumers to load our providers.

## Alternatives and consequences

- A structural contract layer would lose nominal compatibility or duplicate
  hundreds of class members. It belongs to a separate extension API redesign.
- Merging the core class modules would combine unrelated responsibilities and
  thousands of lines merely to reduce a graph metric.
- An indexed registry for every type works, but same-name interfaces avoid
  indexed lookups for the class and object types that support inheritance.
- Source navigation now passes through the leaf interface. A partial source
  program must include its providers; importing the supported barrel does so.
- Declaration publishing has an additional transformation. A compiler and
  API Extractor integration test checks nominal, generic, and union types in
  an isolated consumer. Source type assertions check the graph/node contracts.
