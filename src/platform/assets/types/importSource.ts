/**
 * Supported model import sources
 */
export type ImportSourceType = 'civitai' | 'huggingface'

/**
 * Handler interface for different model import sources
 * Each source provides URL validation
 * Metadata fetching is handled by the shared backend endpoint
 */
export interface ImportSourceHandler {
  /**
   * Unique identifier for this import source
   */
  readonly type: ImportSourceType

  /**
   * Display name for the source
   */
  readonly name: string

  /**
   * Check if a URL belongs to this import source
   */
  validateUrl(url: string): boolean
}
