type FramePhase = 'update' | 'present'

const frames = new WeakMap<
  HTMLCanvasElement,
  Record<FramePhase, Set<() => void>>
>()

export function onCanvasFrame(
  canvas: HTMLCanvasElement,
  phase: FramePhase,
  callback: () => void
): () => void {
  let frame = frames.get(canvas)
  if (!frame) {
    frame = { update: new Set(), present: new Set() }
    frames.set(canvas, frame)
  }
  const callbacks = frame[phase]
  callbacks.add(callback)
  return () => {
    callbacks.delete(callback)
  }
}

export function runCanvasFramePhase(
  canvas: HTMLCanvasElement,
  phase: FramePhase
): void {
  const callbacks = frames.get(canvas)?.[phase]
  if (!callbacks) return
  for (const callback of callbacks) callback()
}
