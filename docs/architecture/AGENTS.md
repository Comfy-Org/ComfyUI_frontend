# Architecture Docs Guidelines

Canonical vocabulary and cross-cutting invariants for the graph domain. Read
these before proposing or objecting to a design in this area.

- `domain-glossary.md` — strict definitions of Widget, Value, Schema, Topology,
  Layout, Promotion, Entity/Component/System, and the subgraph terms. Use these
  words with these meanings; add a term here rather than redefining it in a
  review thread.
- `canonical-knowledge.md` — how design knowledge from outside this repo becomes
  binding here, and the vendoring rules for external design knowledge.

The remaining documents describe the ECS migration
(`ecs-target-architecture.md`, `ecs-migration-plan.md`, `proto-ecs-stores.md`,
`entity-interactions.md`, `entity-problems.md`,
`subgraph-boundaries-and-promotion.md`) and are anchored to
[ADR 0008](../adr/0008-entity-component-system.md). Several carry
"Superseded"/"Post-pivot" banners from PR 12617 — read the banner before
treating a section as current.

## Writing rules for this directory

- Anything asserted as a current invariant must be checkable against code on
  `main`, and must cite where. Unverifiable claims go under a "direction of
  travel" heading or get dropped.
- Material imported from another repo, Notion, or a meeting carries the source
  header described in `canonical-knowledge.md`, pinned to a commit or date.
- Do not add a second glossary. `domain-glossary.md` is the only one.
