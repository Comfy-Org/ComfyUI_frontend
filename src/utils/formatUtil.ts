/**
 * Format bytes to human-readable size
 * Copied from packages/shared-frontend-utils/src/formatUtil.ts
 */
export function formatSize(value?: number) {
  if (value === null || value === undefined) {
    return '-'
  }

  const bytes = value
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
