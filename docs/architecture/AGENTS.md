# Architecture Docs Guidelines

Canonical vocabulary and cross-cutting invariants for the graph domain. Read
these before proposing or objecting to a design in this area.

- `domain-glossary.md` — strict definitions of Widget, Value, Schema, Topology,
  Layout, Promotion, Entity/Component/System, and the subgraph terms. Use these
  words with these meanings; add a term here rather than redefining it in a
  review thread.
- `extension-api-v2-axioms.md` — the A1–A16 axioms and T1–T8 theorems, vendored
  from the ecosystem workspace. **§2 is binding on current code; §3 is a target
  surface and must not be enforced against `main`; §4 lists where the axioms are
  wrong about `main` today.** If you are about to cite "the axioms" in review,
  cite a section number from this file.
- `canonical-knowledge.md` — how design knowledge from outside this repo becomes
  binding here, and the vendoring rules the file above follows.

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
