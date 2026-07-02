/**
 * World — the central registry for all entity state.
 *
 * The World is a typed container mapping branded entity IDs to their
 * component sets. Systems query the World to read/write components;
 * entities never reference each other directly.
 *
 * This is the initial type definition (Phase 1c of the migration plan).
 * The implementation starts as plain Maps. CRDT backing, transactions,
 * and reactivity are future concerns.
 */

import type {
  Connectivity,
  Execution,
  NodeType,
  NodeVisual,
  Properties,
  WidgetContainer
} from './components/node'
import type { GroupChildren, GroupMeta, GroupVisual } from './components/group'
import type { LinkEndpoints, LinkState, LinkVisual } from './components/link'
import type { Position } from './components/position'
import type { RerouteLinks, RerouteVisual } from './components/reroute'
import type {
  SlotConnection,
  SlotIdentity,
  SlotVisual
} from './components/slot'
import type { SubgraphMeta, SubgraphStructure } from './components/subgraph'
import type {
  WidgetIdentity,
  WidgetLayout,
  WidgetValue
} from './components/widget'
import type {
  GroupEntityId,
  LinkEntityId,
  NodeEntityId,
  RerouteEntityId,
  SlotEntityId,
  SubgraphEntityId,
  WidgetEntityId
} from './entityId'

// -- Component bundles per entity kind --------------------------------------

export interface NodeComponents {
  position: Position
  nodeType: NodeType
  visual: NodeVisual
  connectivity: Connectivity
  execution: Execution
  properties: Properties
  widgetContainer: WidgetContainer
}

export interface LinkComponents {
  endpoints: LinkEndpoints
  visual: LinkVisual
  state: LinkState
}

export interface SlotComponents {
  identity: SlotIdentity
  connection: SlotConnection
  visual: SlotVisual
}

export interface WidgetComponents {
  identity: WidgetIdentity
  value: WidgetValue
  layout: WidgetLayout
}

export interface RerouteComponents {
  position: Position
  links: RerouteLinks
  visual: RerouteVisual
}

export interface GroupComponents {
  position: Position
  meta: GroupMeta
  visual: GroupVisual
  children: GroupChildren
}

export interface SubgraphComponents {
  structure: SubgraphStructure
  meta: SubgraphMeta
}

// -- Entity kind registry ---------------------------------------------------

export interface EntityKindMap {
  node: { id: NodeEntityId; components: NodeComponents }
  link: { id: LinkEntityId; components: LinkComponents }
  slot: { id: SlotEntityId; components: SlotComponents }
  widget: { id: WidgetEntityId; components: WidgetComponents }
  reroute: { id: RerouteEntityId; components: RerouteComponents }
  group: { id: GroupEntityId; components: GroupComponents }
  subgraph: { id: SubgraphEntityId; components: SubgraphComponents }
}

export type EntityKind = keyof EntityKindMap

// -- World interface --------------------------------------------------------

export interface World {
  /** Per-kind entity stores. */
  nodes: Map<NodeEntityId, NodeComponents>
  links: Map<LinkEntityId, LinkComponents>
  slots: Map<SlotEntityId, SlotComponents>
  widgets: Map<WidgetEntityId, WidgetComponents>
  reroutes: Map<RerouteEntityId, RerouteComponents>
  groups: Map<GroupEntityId, GroupComponents>
  subgraphs: Map<SubgraphEntityId, SubgraphComponents>

  /**
   * Create a new entity of the given kind, returning its branded ID.
   * The entity starts with no components — call setComponent() to populate.
   */
  createEntity<K extends EntityKind>(kind: K): EntityKindMap[K]['id']

  /**
   * Remove an entity and all its components.
   * Returns true if the entity existed, false otherwise.
   */
  deleteEntity<K extends EntityKind>(
    kind: K,
    id: EntityKindMap[K]['id']
  ): boolean

  /**
   * Get a single component from an entity.
   * Returns undefined if the entity or component doesn't exist.
   */
  getComponent<
    K extends EntityKind,
    C extends keyof EntityKindMap[K]['components']
  >(
    kind: K,
    id: EntityKindMap[K]['id'],
    component: C
  ): EntityKindMap[K]['components'][C] | undefined

  /**
   * Set a single component on an entity.
   * Creates the component if it doesn't exist, overwrites if it does.
   */
  setComponent<
    K extends EntityKind,
    C extends keyof EntityKindMap[K]['components']
  >(
    kind: K,
    id: EntityKindMap[K]['id'],
    component: C,
    data: EntityKindMap[K]['components'][C]
  ): void
}

// -- Factory ----------------------------------------------------------------

export function createWorld(): World {
  const counters = {
    node: 0,
    link: 0,
    slot: 0,
    widget: 0,
    reroute: 0,
    group: 0,
    subgraph: 0
  }

  const stores = {
    nodes: new Map<NodeEntityId, NodeComponents>(),
    links: new Map<LinkEntityId, LinkComponents>(),
    slots: new Map<SlotEntityId, SlotComponents>(),
    widgets: new Map<WidgetEntityId, WidgetComponents>(),
    reroutes: new Map<RerouteEntityId, RerouteComponents>(),
    groups: new Map<GroupEntityId, GroupComponents>(),
    subgraphs: new Map<SubgraphEntityId, SubgraphComponents>()
  }

  const storeForKind: Record<EntityKind, Map<unknown, unknown>> = {
    node: stores.nodes,
    link: stores.links,
    slot: stores.slots,
    widget: stores.widgets,
    reroute: stores.reroutes,
    group: stores.groups,
    subgraph: stores.subgraphs
  }

  return {
    ...stores,

    createEntity<K extends EntityKind>(kind: K): EntityKindMap[K]['id'] {
      const id = ++counters[kind]
      const store = storeForKind[kind]
      store.set(id, {} as never)
      return id as EntityKindMap[K]['id']
    },

    deleteEntity<K extends EntityKind>(
      kind: K,
      id: EntityKindMap[K]['id']
    ): boolean {
      return storeForKind[kind].delete(id)
    },

    getComponent<
      K extends EntityKind,
      C extends keyof EntityKindMap[K]['components']
    >(
      kind: K,
      id: EntityKindMap[K]['id'],
      component: C
    ): EntityKindMap[K]['components'][C] | undefined {
      const entity = storeForKind[kind].get(id) as
        | EntityKindMap[K]['components']
        | undefined
      return entity?.[component]
    },

    setComponent<
      K extends EntityKind,
      C extends keyof EntityKindMap[K]['components']
    >(
      kind: K,
      id: EntityKindMap[K]['id'],
      component: C,
      data: EntityKindMap[K]['components'][C]
    ): void {
      const entity = storeForKind[kind].get(id)
      if (entity) {
        Object.assign(entity, { [component]: data })
      }
    }
  }
}
