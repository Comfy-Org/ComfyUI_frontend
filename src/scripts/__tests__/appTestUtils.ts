import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'

/**
 * `ComfyApp.setup` is the only production writer of the root graph, and it needs
 * a real canvas. Tests that just need a graph in place reach the same storage
 * through this seam instead.
 */
export function setRootGraph(app: ComfyApp, graph: LGraph | undefined) {
  app['rootGraphRef'].value = graph
}

export function getRootGraph(app: ComfyApp) {
  return app['rootGraphRef'].value
}
