# Appendix: ECS pattern survey

Status: Historical survey with current conclusions
Verified: 2026-08-20 against `13a302eadda871b939b148ecb87e3d845ceefff2`

The original appendix analyzed a central `src/world` prototype. That prototype,
its `ComponentKey`, entity-ID factories, widget component module, and proposed
command executor were deleted by PR 12617. They are historical and must not be
read as aliases for current dedicated stores.

## External patterns

The original survey compared bitECS, miniplex, koota, ECSY, Thyseus, and Bevy.
Two conclusions remain useful:

1. Components belong with the domain code that owns them rather than in a
   universal substrate package.
2. The public storage/mutation surface should remain small enough that identity,
   lifecycle, and write guarantees are understandable per concern.

The current dedicated-store direction follows those conclusions. Each store
chooses the identity and scope appropriate to its concern: composite string keys,
root buckets containing branded numeric IDs, owner indexes, or scoped layout
keys. There is no central World or universal entity-ID representation.

## Patterns retained in the current direction

- **Plain component records:** authoritative state should be plain data without
  methods or parent-object back-references.
- **Domain-owned stores:** topology, node shell, reroute chain, widget, layout,
  output, and other concerns use focused ownership rather than one registry.
- **Stable reactive identity where compatibility needs it:** node, link, reroute,
  and widget classes can adopt the store-returned proxy during migration.
- **Derived presentation data:** badges, connectivity projections, execution
  order, and transient renderer geometry should not become independent persisted
  components unless a measured requirement establishes new authority.
- **Command-shaped durable mutation:** the target requires serializable,
  deterministic, idempotent, replayable, undoable, and CRDT-transmittable
  operations. Only layout currently implements this shape; imperative,
  snapshot-undone general graph mutation is deferred to the next phase.

## Patterns not implied by the decision

- A universal World, uniform key type, archetype storage, or synthetic slot IDs.
- A fixed-step ECS scheduler or worker-thread runtime. Vue remains the UI
  scheduler unless profiling demonstrates a separate CPU-bound system phase.
- Deferred command buffering merely because Bevy or Thyseus uses it. The graph
  needs explicit transaction, callback, undo, and failure semantics first.
- SoA or sparse-set storage without profiling. Current entity counts and Vue
  proxy compatibility favor focused reactive maps and Yjs layout records.
- Substrate-owned parent/child relations when one domain-specific index or query
  owns the relationship.

## Revisit criteria

- Revisit storage layout only after representative large-workflow profiling
  identifies store iteration or lookup as a material frame-time cost.
- Revisit a system scheduler only when multiple implemented system phases need
  explicit ordering or a profiled data-disjoint pass justifies worker transfer.
- Revisit identity shapes only when current root/owner/locator contracts fail a
  concrete feature; do not normalize keys for aesthetic uniformity.
- Revisit compatibility proxy identity only with measured extension usage and a
  migration path for live object consumers.

## References

- [ADR-ECS: Entity Component System](../adr/ECS-entity-component-system.md)
- [ECS target architecture](ecs-target-architecture.md)
- [ECS migration plan](ecs/ecs-migration-plan.md)
- [Proto-ECS stores](proto-ecs-stores.md)
