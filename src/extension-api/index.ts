/**
 * `@comfyorg/extension-api` — public v2 extension surface (first slice).
 *
 * Authors register node behaviour with the module-level {@link defineNodeExtension}
 * entry point and receive a pre-bound {@link NodeHandle} in `nodeCreated` — the
 * handle is delivered by the framework, never fetched by id from a global
 * (D6/D11 entry-point shape; D3.3 event-based handles).
 *
 * Phase A bridge: until `@comfyorg/extension-api` publishes, this registers over
 * the existing `app.registerExtension` per-node `nodeCreated` lifecycle and wraps
 * the raw `LGraphNode` in a `NodeHandle`. The public author-facing shape does not
 * change when the package ships (D6.1 recommendation: CS-A for Phase A).
 */
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

import { createNodeHandle } from './node'
import type { NodeHandle } from './node'

export type { NodeHandle } from './node'
export type { Point, Size } from './types'

export interface NodeExtensionOptions {
  /** Unique extension name. */
  name: string
  /**
   * Restrict `nodeCreated` to these node types (comfyClass names). Omit to run
   * for every node.
   */
  nodeTypes?: string[]
  /** Runs once per matching node instance, with a handle bound to that node. */
  nodeCreated?(node: NodeHandle): void
}

/**
 * Register a node extension. `nodeCreated` fires once per node instance (filtered
 * by `nodeTypes`) and receives a {@link NodeHandle} for that node.
 */
export function defineNodeExtension(options: NodeExtensionOptions): void {
  app.registerExtension({
    name: options.name,
    nodeCreated(node: LGraphNode) {
      const type = node.comfyClass ?? node.type ?? ''
      if (options.nodeTypes && !options.nodeTypes.includes(type)) return
      options.nodeCreated?.(createNodeHandle(node))
    }
  })
}

/** The experimental v2 extension entry points reachable in-app. */
export interface ComfyExtensionApi {
  defineNodeExtension(options: NodeExtensionOptions): void
}

declare global {
  interface Window {
    /**
     * Experimental: the v2 extension API entry points, exposed in-app while
     * `@comfyorg/extension-api` is unpublished. This is the registration entry —
     * node handles are still delivered via `nodeCreated`, never fetched by id.
     */
    comfyExtensionApi?: ComfyExtensionApi
  }
}

/** Install the experimental v2 extension entry points on `window`. */
export function installExtensionApi(): void {
  window.comfyExtensionApi = { defineNodeExtension }
}
