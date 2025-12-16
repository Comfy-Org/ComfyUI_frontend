/**
 * Supported model import sources
 */
type ImportSourceType = 'civitai' | 'huggingface'

/**
 * Configuration for a model import source
 */
export interface ImportSource {
  /**
   * Unique identifier for this import source
   */
  readonly type: ImportSourceType

  /**
   * Display name for the source
   */
  readonly name: string

  /**
   * Hostname(s) that identify this source
   */
  readonly hostnames: readonly string[]
}

/**
 * Check if a URL belongs to a specific import source
 */
export function validateSourceUrl(url: string, source: ImportSource): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return source.hostnames.some(
      (h) => hostname === h || hostname.endsWith(`.${h}`)
    )
  } catch {
    return false
  }
}
