function isUsableFps(fps: number | undefined): fps is number {
  return fps !== undefined && Number.isFinite(fps) && fps > 0
}

export function frameToTime(
  frame: number,
  duration: number,
  frameMax: number,
  fallbackFps?: number
): number {
  if (duration > 0 && frameMax > 0) return (frame / frameMax) * duration
  return isUsableFps(fallbackFps) ? frame / fallbackFps : 0
}

export function timeToFrame(
  time: number,
  duration: number,
  frameMax: number,
  fallbackFps?: number
): number {
  if (duration > 0 && frameMax > 0) {
    return Math.round((time / duration) * frameMax)
  }
  return isUsableFps(fallbackFps) ? Math.round(time * fallbackFps) : 0
}

export function roundSeconds(seconds: number): number {
  return Math.round(seconds * 1000) / 1000
}
