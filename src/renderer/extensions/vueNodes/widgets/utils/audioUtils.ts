export { getResourceURL, splitFilePath } from '@/utils/resourceUrl'

/**
 * Format time in MM:SS format
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds === 0) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
