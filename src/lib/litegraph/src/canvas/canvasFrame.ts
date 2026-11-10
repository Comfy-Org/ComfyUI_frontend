type FramePhase = 'update' | 'present'

const frames = new WeakMap<object, Record<FramePhase, Set<() => void>>>()

export function onCanvasFrame(
  canvas: object,
  phase: FramePhase,
  callback: () => void
): () => void {
  const frame = frames.get(canvas) ?? {
    update: new Set<() => void>(),
    present: new Set<() => void>()
  }
  frames.set(canvas, frame)
  const callbacks = frame[phase]
  callbacks.add(callback)
  return () => {
    callbacks.delete(callback)
  }
}

export function runCanvasFramePhase(canvas: object, phase: FramePhase): void {
  for (const callback of frames.get(canvas)?.[phase] ?? []) callback()
}
