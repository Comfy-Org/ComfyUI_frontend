interface WorkflowView {
  scale: number
  offset: [number, number]
}

export function parseWorkflowView(value: unknown): WorkflowView | undefined {
  if (typeof value !== 'object' || value === null) return

  const scale = 'scale' in value ? value.scale : undefined
  const offset = 'offset' in value ? value.offset : undefined
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return
  if (
    !Array.isArray(offset) ||
    typeof offset[0] !== 'number' ||
    typeof offset[1] !== 'number' ||
    !Number.isFinite(offset[0]) ||
    !Number.isFinite(offset[1])
  ) {
    return
  }

  return { scale, offset: [offset[0], offset[1]] }
}
