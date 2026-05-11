/**
 * Mini ComfyApp facade — I-TF.3
 *
 * The smallest object shaped like the legacy `app` global that v1
 * snippets reach for: `app.graph`, `app.extensions`, `app.queuePrompt`.
 * Backed by the harness World; everything is in-memory and side-effect
 * free.
 *
 * v1 snippets typically do something like:
 *   app.registerExtension({ name, beforeRegisterNodeDef, ... })
 * or:
 *   app.graph.add(node)
 *   app.queuePrompt()
 *
 * We capture the surface so the v1 runner (`runV1.ts`) can replay the
 * call without touching the real LiteGraph or backend.
 */

import { createHarnessWorld } from './world'
import type { HarnessWorld } from './world'

export interface MiniGraph {
  /** Mirror LGraph.add — registers a node-shaped object. */
  add(node: { type?: string; comfyClass?: string }): number
  /** Mirror LGraph.remove — deletes by entityId. */
  remove(entityId: number): boolean
  /** Mirror LGraph.findNodesByType — used by S11.G2 patterns. */
  findNodesByType(type: string): unknown[]
}

export interface MiniExtensionRegistration {
  name: string
  // Permissive bag — v1 extensions wear many shapes.
  [key: string]: unknown
}

export interface MiniComfyApp {
  graph: MiniGraph
  extensions: MiniExtensionRegistration[]
  /** No-op stand-in. Returns a resolved promise so awaited callers don't hang. */
  queuePrompt(): Promise<void>
  /** Register a v1 extension. Stores it for later inspection by tests. */
  registerExtension(ext: MiniExtensionRegistration): void
  /** Underlying harness World for advanced assertions. */
  world: HarnessWorld
}

export function createMiniComfyApp(
  world: HarnessWorld = createHarnessWorld()
): MiniComfyApp {
  const extensions: MiniExtensionRegistration[] = []

  const graph: MiniGraph = {
    add(node) {
      return world.addNode({
        type: node.type ?? 'Unknown',
        comfyClass: node.comfyClass ?? node.type ?? 'Unknown'
      })
    },
    remove(entityId) {
      return world.removeNode(entityId)
    },
    findNodesByType(type) {
      return world.findNodesByType(type).slice()
    }
  }

  return {
    graph,
    extensions,
    world,
    async queuePrompt() {
      // Intentional no-op for the harness — see I-TF scope notes.
    },
    registerExtension(ext) {
      extensions.push(ext)
    }
  }
}
