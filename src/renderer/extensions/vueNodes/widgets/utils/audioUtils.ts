import { getResourceURL, splitFilePath } from '@/extensions/core/uploadAudio'
import type { ResultItemType } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

/**
 * Format time in MM:SS format
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds === 0) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Get full audio URL from path
 */
export function getAudioUrlFromPath(
  path: string,
  type: ResultItemType = 'input'
): string {
  const [subfolder, filename] = splitFilePath(path)
  return api.apiURL(getResourceURL(subfolder, filename, type))
}
