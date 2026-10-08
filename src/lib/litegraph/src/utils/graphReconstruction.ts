const reconstructionDepth = new WeakMap<object, number>()

export function beginReconstruction(
  graph: object | null | undefined
): () => void {
  if (!graph) return () => {}
  reconstructionDepth.set(graph, (reconstructionDepth.get(graph) ?? 0) + 1)
  let finished = false
  return () => {
    if (finished) return
    finished = true
    const depth = (reconstructionDepth.get(graph) ?? 1) - 1
    if (depth > 0) reconstructionDepth.set(graph, depth)
    else reconstructionDepth.delete(graph)
  }
}

export function isReconstructing(graph: object | null | undefined): boolean {
  return !!graph && (reconstructionDepth.get(graph) ?? 0) > 0
}
