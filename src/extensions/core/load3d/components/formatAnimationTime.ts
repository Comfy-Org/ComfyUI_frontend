export function formatAnimationTime(seconds: number): string {
  const tenths = Math.round(seconds * 10)
  const mins = Math.floor(tenths / 600)
  const secs = ((tenths % 600) / 10).toFixed(1)
  return mins > 0 ? `${mins}:${secs.padStart(4, '0')}` : `${secs}s`
}
