export const MS_PER_MINUTE = 60_000

export function tenthsOfSecond(ms: number): string {
  return (ms / 1000).toFixed(1)
}

export function splitMinutes(ms: number): { minutes: number; seconds: number } {
  const seconds = Math.round(ms / 1000)
  return { minutes: Math.floor(seconds / 60), seconds: seconds % 60 }
}

/** Tenths of a second up to a minute, then whole minutes and seconds. */
export function formatDurationCompact(ms: number): string {
  if (ms < MS_PER_MINUTE) return `${tenthsOfSecond(ms)}s`
  const { minutes, seconds } = splitMinutes(ms)
  return `${minutes}m ${seconds}s`
}
