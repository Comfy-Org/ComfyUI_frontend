export function formatAnimationTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(1)
  return mins > 0 ? `${mins}:${secs.padStart(4, '0')}` : `${secs}s`
}
