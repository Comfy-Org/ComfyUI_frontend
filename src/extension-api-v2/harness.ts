/**
 * Test harness for v1/v2 extension compatibility tests.
 * Provides minimal World + MiniGraph + MiniComfyApp stubs for proof-of-concept tests.
 *
 * Phase A limitation: These are minimal stubs. Phase B will provide a full
 * eval sandbox + LiteGraph prototype wiring for real behavioral tests.
 */

type NodeEntityId = string

interface HarnessWorld {
  findNode(id: NodeEntityId): { type: string } | undefined
  allNodes(): NodeEntityId[]
  clear(): void
  _addNode(id: NodeEntityId, data: { type: string }): void
  _removeNode(id: NodeEntityId): void
}

interface MiniGraph {
  add(opts: { type: string }): NodeEntityId
  remove(id: NodeEntityId): void
}

interface MiniComfyApp {
  graph: MiniGraph
}

/**
 * Creates a minimal harness World for testing.
 */
export function createHarnessWorld(): HarnessWorld {
  const nodes = new Map<NodeEntityId, { type: string }>()

  return {
    findNode(id: NodeEntityId) {
      return nodes.get(id)
    },
    allNodes() {
      return [...nodes.keys()]
    },
    clear() {
      nodes.clear()
    },
    _addNode(id: NodeEntityId, data: { type: string }) {
      nodes.set(id, data)
    },
    _removeNode(id: NodeEntityId) {
      nodes.delete(id)
    }
  }
}

/**
 * Creates a minimal MiniComfyApp for testing.
 * The app's graph operations are wired to the provided world.
 */
export function createMiniComfyApp(world: HarnessWorld): MiniComfyApp {
  let idCounter = 0

  return {
    graph: {
      add(opts: { type: string }): NodeEntityId {
        const id = `node:${++idCounter}` as NodeEntityId
        world._addNode(id, { type: opts.type })
        return id
      },
      remove(id: NodeEntityId) {
        world._removeNode(id)
      }
    }
  }
}

// Evidence snapshot loading stubs for S2.* surface coverage
const evidenceSnapshots: Record<string, string[]> = {
  'S2.N4': [
    '// LTXVideo sparse_track_editor.js:137\nnode.onRemoved = function() { cleanup(); }'
  ]
}

/**
 * Returns the number of evidence excerpts for a given surface ID.
 */
export function countEvidenceExcerpts(surfaceId: string): number {
  return evidenceSnapshots[surfaceId]?.length ?? 0
}

/**
 * Loads a specific evidence snippet by surface ID and index.
 */
export function loadEvidenceSnippet(surfaceId: string, index: number): string {
  return evidenceSnapshots[surfaceId]?.[index] ?? ''
}
