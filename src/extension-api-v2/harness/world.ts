/**
 * Harness World — I-TF.3
 *
 * Minimal in-memory ECS-shaped World stub for the v2 extension API
 * test harness. NOT the production World — the real `@/ecs/world`
 * lands in Phase B (ECS-native implementations).
 *
 * Scope is intentionally tiny: enough to support
 *   - add / remove / findNode primitives required by behavior-category
 *     stubs
 *   - a component bag keyed by entityId so v2 NodeHandle stubs can read
 *     position / size / type without depending on Phase B internals
 *   - a `clear()` for between-test isolation
 *
 * The full reactive mount system in `services/extensionV2Service.ts`
 * is intentionally NOT wired here — it pulls in `@/ecs/components`
 * which doesn't exist yet. Sibling PRs will replace this stub with
 * the real World once the ECS land lands.
 */

export type EntityId = number

export interface HarnessNodeRecord {
  entityId: EntityId
  type: string
  comfyClass: string
  position: [number, number]
  size: [number, number]
  title: string
  properties: Record<string, unknown>
}

export interface HarnessWorld {
  /** Insert a node with default geometry. Returns its entityId. */
  addNode(input: {
    type: string
    comfyClass?: string
    position?: [number, number]
    size?: [number, number]
    title?: string
    properties?: Record<string, unknown>
  }): EntityId
  /** Remove a node and any data attached to it. */
  removeNode(entityId: EntityId): boolean
  /** Lookup a node by entityId. Returns undefined when absent. */
  findNode(entityId: EntityId): HarnessNodeRecord | undefined
  /** All nodes currently in the World. */
  allNodes(): readonly HarnessNodeRecord[]
  /** Filter by `type` / `comfyClass`. */
  findNodesByType(type: string): readonly HarnessNodeRecord[]
  /** Reset to empty state. Call between tests. */
  clear(): void
}

export function createHarnessWorld(): HarnessWorld {
  const nodes = new Map<EntityId, HarnessNodeRecord>()
  let nextId: EntityId = 1

  return {
    addNode(input) {
      const entityId = nextId++
      const record: HarnessNodeRecord = {
        entityId,
        type: input.type,
        comfyClass: input.comfyClass ?? input.type,
        position: input.position ?? [0, 0],
        size: input.size ?? [200, 100],
        title: input.title ?? input.type,
        properties: { ...(input.properties ?? {}) }
      }
      nodes.set(entityId, record)
      return entityId
    },
    removeNode(entityId) {
      return nodes.delete(entityId)
    },
    findNode(entityId) {
      return nodes.get(entityId)
    },
    allNodes() {
      return Array.from(nodes.values())
    },
    findNodesByType(type) {
      return Array.from(nodes.values()).filter(
        (n) => n.type === type || n.comfyClass === type
      )
    },
    clear() {
      nodes.clear()
      nextId = 1
    }
  }
}
