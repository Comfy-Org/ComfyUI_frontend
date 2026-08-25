# ECS identity and scope audit

Status: Current implementation audit
Verified: 2026-08-20 against `13a302eadda871b939b148ecb87e3d845ceefff2`

This document records the migration's implemented identity contract. It does
not broaden the accepted ADRs.

## Scope model

An open workflow has one root `LGraph`. Each contained `Subgraph` is an owning
graph. `graphScopeOf()` returns both identities:

- `rootGraphId`: the root workflow UUID and the store/CRDT isolation boundary.
- `owningGraphId`: the UUID of the graph definition that owns the entity.

A subgraph definition is stored once even when several `SubgraphNode` instances
reference it. Definition-scoped state is therefore shared by those instances.
Runtime execution paths are a separate identity domain.

## Authoritative key table

| Entity or key         | Runtime identity / key                                   | Scope and authority                                                          | Allocation / notes                                                                                                                  |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Root graph            | `LGraph.id` UUID                                         | Application/workflow                                                         | Serialized as the workflow graph ID. Root store buckets use `RootGraphId`.                                                          |
| Owning graph          | root or `Subgraph.id` UUID                               | Root workflow                                                                | Serialized subgraph-definition ID; `GraphScope` pairs it with the root ID.                                                          |
| Node                  | `NodeId`                                                 | Owning graph logically; normalized unique across the recursive root workflow | `mintNodeId(root.state)`; numeric imported IDs advance the root allocator. String IDs are valid but do not advance it.              |
| Node locator          | root: `<nodeId>`; subgraph: `<definition UUID>:<nodeId>` | Definition, not instance                                                     | `createNodeLocatorId()`; stable across every instance of one subgraph definition.                                                   |
| Node execution        | `<subgraph-instance-node-id>:...:<nodeId>`               | Invocation path                                                              | `NodeExecutionId`; resolves nested runtime messages, not persisted component ownership.                                             |
| Link                  | `LinkId`                                                 | Root bucket, partitioned by owning graph                                     | `mintLinkId(root.state)`. `linkStore` is the identity authority; IDs must be unique throughout the root bucket.                     |
| Link target endpoint  | `${owningGraphId}:${nodeId}:${slot}`                     | Owning graph in a root bucket                                                | Private `targetKey()`; one non-floating link per input.                                                                             |
| Link origin endpoint  | `${owningGraphId}:${nodeId}:${slot}`                     | Owning graph in a root bucket                                                | Private `originKey()`; indexes a set because outputs fan out.                                                                       |
| Reroute               | `RerouteId`                                              | Root bucket, partitioned by owning graph                                     | `mintRerouteId(root.state)`; `rerouteStore` rejects an ID already held in that root bucket.                                         |
| Group                 | `GroupId`                                                | Owning graph logically; layout key uses root                                 | `mintGroupId(root.state)`; serialized in its owning graph.                                                                          |
| Widget value          | `${rootGraphId}:${encode(nodeId)}:${encode(name)}`       | Root workflow                                                                | `widgetId()`; root-wide node ID uniqueness disambiguates widgets in nested definitions.                                             |
| Node layout           | `${rootGraphId}:${nodeId}`                               | Root workflow                                                                | `makeScopedLayoutKey()` in `layoutStore`; node IDs must therefore be root-unique.                                                   |
| Group layout          | `${rootGraphId}:${groupId}`                              | Root workflow                                                                | Same layout-key constructor; relies on recursive group-ID normalization.                                                            |
| Reroute layout        | `${rootGraphId}:${rerouteId}`                            | Root workflow                                                                | Same layout-key constructor; relies on recursive reroute-ID normalization.                                                          |
| Node output / preview | `NodeLocatorId`                                          | Graph definition                                                             | `nodeOutputStore` maps execution IDs to locators before access. Multiple instances of one definition intentionally share the entry. |
| Slot geometry         | `${nodeId}-in-${index}` / `${nodeId}-out-${index}`       | Unscoped layout spatial index                                                | `slotId()`; safe only while node IDs remain root-unique.                                                                            |
| Link segment geometry | `${linkId}:${rerouteId ?? 'final'}`                      | Unscoped layout spatial index                                                | `makeLinkSegmentKey()`; safe only while link and reroute IDs remain root-unique.                                                    |

Stable definitions are in `src/types/graphScopeId.ts`,
`src/lib/litegraph/src/idAllocation.ts`, `src/types/nodeIdentification.ts`,
`src/types/widgetId.ts`, and `src/types/slotId.ts`.

## Allocation and recursive ownership

`LGraph.state` holds the four monotonic counters. Subgraphs delegate allocation
to the root state rather than maintaining independent ID spaces. During load,
ID reservation happens per-node at add time: `LGraph.add` mints or observes the
node ID, then `attachNodeToStores` retries registration with freshly minted IDs
until the store accepts one (`LGraph.ts:1148-1169`,
`nodeShellLifecycle.ts:19-24`).
`linkStore` and `rerouteStore` then store entities under a root bucket and an
owning-graph partition. Owner filtering prevents topology queries in one
definition from seeing another definition's entities even though IDs share a
root-wide allocation domain.

Recursive subgraphs do not create an instance-local component namespace.
Topology, widgets, layout, and locator-based output data describe definitions.
Only `NodeExecutionId` includes the nested instance path. Code handling backend
events must resolve execution identity before reading definition-scoped output.

The allocation counters are serialized mutable class state, not store records
or commands. Compatibility setters and clipboard/import paths can assign or
increment them directly. Deterministic replay therefore requires creation and
import operations to record assigned IDs rather than minting from ambient
counter state.

## Collision normalization

`normalizeSubgraphDefinitions()` in
`src/lib/litegraph/src/subgraph/subgraphDeduplication.ts` traverses definitions
in dependency order. It preserves the first owner of an ID and remaps later
cross-definition node, link, reroute, and group collisions from the root
allocator. Remaps also patch regular and floating link endpoints, reroute and
group references, promoted-widget references, and proxy-widget metadata.

`normalizeConfiguredTopology()` in `src/lib/litegraph/src/linkDeduplication.ts` separately
enforces one live link per target slot, removes duplicate topology, remaps
references, and realigns serialized slot mirrors after nodes are configured.
Runtime registration is deliberately not a repair boundary. `linkStore` and
`rerouteStore` preserve the incumbent and reject colliding arrivals.

## Persistence and transfer boundaries

- `LGraph.asSerialisable()` writes each owning graph's local
  entities and topology while retaining definition UUIDs and allocated IDs.
- Deserialization and import reserve and normalize the complete recursive set
  before registration. This is the authoritative persisted-ID repair boundary.
- `LGraphCanvas.copyToClipboard()` serializes selected entities. Paste
  regenerates copied subgraph UUIDs and remaps cloned entity IDs before
  recursive insertion.
- `workflowToClipboardItems()` and `workflowService` flatten and
  normalize recursively imported definitions before adding them to the root.
- `replaceWithMapping()` preserves the node ID and transfers
  registered shell and layout ownership. New widgets register under the same
  IDs and can adopt retained widget state; links continue to address the same
  node identity.

## Remaining distributed invariants and risks

1. Root-wide uniqueness is enforced by a combination of allocator discipline,
   import normalization, and rejecting stores, not by one composite key type.
2. Slot and link-segment geometry keys omit graph scope. A missed normalization
   path can alias geometry even though topology queries are owner-filtered.
3. Layout keys include the root UUID but omit the owning graph UUID; recursive
   node/group/reroute uniqueness remains mandatory.
4. `widgetId()` uses the root graph UUID, not the owning graph UUID. It assumes
   graph UUIDs contain no colon; encoded node/name segments make their
   separators safe. Layout parsing has the same UUID assumption.
5. Numeric-looking string node IDs affect layout and endpoint keys but allocator
   observation only advances for integer conversion. Mixed imported ID forms
   need continued collision coverage.
6. Locator-keyed outputs intentionally conflate instances of one definition.
   Per-instance concurrent output retention would require execution-path keys.
7. Direct extension insertion that bypasses import normalization can be
   rejected after partial surrounding work. Use graph APIs and handle failure;
   see
   [Link registration migration](../../extensions/link-registration-migration.md).

## Evidence and remaining tests

Current regression evidence includes `subgraphDeduplication.test.ts`,
`idAllocation.test.ts`, `linkStore.test.ts`, `rerouteStore.test.ts`,
`copyPaste.spec.ts`, `subgraphLinkIdentity.spec.ts`, and
`nodeReplacement.spec.ts`.

Follow-up evidence should add adversarial recursive fixtures covering group and
reroute collisions together, string/numeric node-ID equivalence, clipboard
insertion into a root with occupied geometry keys, and concurrent outputs from
two instances of one subgraph. Planned lifecycle ownership details belong in
`ecs-lifecycle-scenarios.md`; target structure remains in
`ecs-target-architecture.md`.
