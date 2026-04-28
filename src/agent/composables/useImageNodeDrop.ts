import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

/**
 * Drop an uploaded image into the active graph as a LoadImage node.
 *
 * Given an uploaded filename (the part after `/input/` returned by
 * /upload/image), add a LoadImage node at a reasonable position and
 * set its widget to the filename. Capture an undo snapshot so Ctrl/Cmd+Z
 * reverts the insertion.
 *
 * Returns the id of the newly created node, or null if the graph was
 * not available or the node type is not registered.
 */
export function dropImageAsLoadImageNode(filename: string): number | null {
  const canvas = useCanvasStore().canvas
  const graph = canvas?.graph as
    | { _nodes: { pos: [number, number]; size: [number, number] }[] }
    | undefined
  if (!canvas || !graph) return null

  // Position: to the right of the rightmost existing node, same y as the
  // topmost. Feels natural when adding a reference image alongside a
  // workflow.
  let right = 100
  let top = 100
  const nodes = graph._nodes ?? []
  if (nodes.length > 0) {
    right = Math.max(
      ...nodes.map((n) => (n.pos?.[0] ?? 0) + (n.size?.[0] ?? 200))
    )
    right += 40
    top = Math.min(...nodes.map((n) => n.pos?.[1] ?? 0))
  }

  // The global LiteGraph instance is installed by the app startup; access
  // it via window to avoid tangling imports.
  const LG = (
    window as unknown as { LiteGraph?: { createNode: (t: string) => unknown } }
  ).LiteGraph
  if (!LG) return null
  const node = LG.createNode('LoadImage') as {
    id: number
    pos: [number, number]
    widgets?: {
      name?: string
      value?: unknown
      callback?: (v: unknown) => void
    }[]
  } | null
  if (!node) return null

  node.pos = [right, top]
  // Set the 'image' widget to the uploaded filename
  const widget = node.widgets?.find((w) => w.name === 'image')
  if (widget) {
    widget.value = filename
    widget.callback?.(filename)
  }
  ;(graph as unknown as { add: (n: unknown) => void }).add(node)
  canvas.setDirty(true, true)

  try {
    useWorkflowStore().activeWorkflow?.changeTracker?.checkState()
  } catch {
    /* no active workflow */
  }

  return node.id
}
