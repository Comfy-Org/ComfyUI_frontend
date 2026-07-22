/**
 * NodeHandle — first slice of the stable node API.
 *
 * The sanctioned, command-backed replacement for the legacy imperative idiom
 * `node.size[1] = h`. `setSize` dispatches the `Comfy.Node.Resize` command,
 * which commits through `layoutStore` (the single source of truth) so Vue nodes
 * reflow. This is the migration destination for the runtime `size` Proxy in
 * PR #13867 — see `research/architecture/reflow-design-incodebase.md` (option d).
 */
import type { Size } from '@/renderer/core/layout/types'
import { useCommandStore } from '@/stores/commandStore'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'

export interface NodeHandle {
  /** The id of the node this handle controls. */
  readonly id: NodeId
  /**
   * Resize the node to an explicit size. Routes through the `Comfy.Node.Resize`
   * command → `layoutStore`, so the Vue node reflows to the new height.
   */
  setSize(width: number, height: number): Promise<void>
  /**
   * Resize the node to fit its intrinsic content.
   *
   * TODO(stable-resize-api A2): not implemented — depends on the content-measure
   * path in `research/architecture/reflow-design-incodebase.md` §3(a).
   */
  autosize(): Promise<void>
  /**
   * Subscribe to resize events for this node; returns an unsubscribe function.
   *
   * TODO(stable-resize-api A3): not implemented — depends on a public event
   * surface over `layoutStore`, see
   * `research/architecture/reflow-design-vue-reactivity.md` §1.
   */
  on(event: 'resize', handler: (size: Size) => void): () => void
}

interface ComfyNodeApi {
  /** Get a handle for controlling a node by id. */
  getNode(id: SerializedNodeId): NodeHandle
}

declare global {
  interface Window {
    /** Experimental: first slice of the stable node API (resize). */
    comfyNodeApi?: ComfyNodeApi
  }
}

export function createNodeHandle(id: SerializedNodeId): NodeHandle {
  const nodeId = toNodeId(id)
  return {
    id: nodeId,
    async setSize(width: number, height: number): Promise<void> {
      await useCommandStore().execute('Comfy.Node.Resize', {
        metadata: { nodeId, width, height }
      })
    },
    async autosize(): Promise<void> {
      throw new Error(
        'NodeHandle.autosize() is not implemented yet (follow-up A2). ' +
          'See research/architecture/reflow-design-incodebase.md §3(a).'
      )
    },
    on(event: 'resize'): () => void {
      throw new Error(
        `NodeHandle.on('${event}') is not implemented yet (follow-up A3). ` +
          'See research/architecture/reflow-design-vue-reactivity.md §1.'
      )
    }
  }
}

const nodeApi: ComfyNodeApi = {
  getNode: createNodeHandle
}

/**
 * Expose the node API on `window` as the experimental public entry point that
 * extensions and the browser console can reach.
 */
export function installNodeApi(): void {
  window.comfyNodeApi = nodeApi
}
