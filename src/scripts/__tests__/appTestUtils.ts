import type { ShallowRef } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'

/**
 * `ComfyApp.setup` is the only production writer of the root graph, and it needs
 * a real canvas. Tests that just need a graph in place reach the same storage
 * through this seam instead.
 */
type AppWithRootGraphRef = { rootGraphRef: ShallowRef<LGraph | undefined> }

const rootGraphRefOf = (app: ComfyApp) =>
  (app as unknown as AppWithRootGraphRef).rootGraphRef

export function setRootGraph(app: ComfyApp, graph: LGraph | undefined) {
  rootGraphRefOf(app).value = graph
}

export function getRootGraph(app: ComfyApp) {
  return rootGraphRefOf(app).value
}
