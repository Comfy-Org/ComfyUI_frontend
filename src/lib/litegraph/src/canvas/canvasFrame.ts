type FramePhase = 'update' | 'present'

type FrameCallback = (frameIntervalMs: number) => void

const frames = new WeakMap<object, Record<FramePhase, Set<FrameCallback>>>()

export function onCanvasFrame(
  canvas: object,
  phase: FramePhase,
  callback: FrameCallback
): () => void {
  const frame = frames.get(canvas) ?? {
    update: new Set<FrameCallback>(),
    present: new Set<FrameCallback>()
  }
  frames.set(canvas, frame)
  const callbacks = frame[phase]
  callbacks.add(callback)
  return () => {
    callbacks.delete(callback)
  }
}

export function runCanvasFramePhase(
  canvas: object,
  phase: FramePhase,
  frameIntervalMs = 0
): void {
  for (const callback of frames.get(canvas)?.[phase] ?? [])
    callback(frameIntervalMs)
}
