import { api } from '@/scripts/api'

export type FileType = 'input' | 'output' | 'temp'

export interface FileNameMapping {
  [hashFilename: string]: string // hash -> human readable name
}

export interface CacheEntry {
  data: FileNameMapping
  timestamp: number
  error?: Error | null
  fetchPromise?: Promise<FileNameMapping>
  failed?: boolean
}

/**
 * Service for fetching and caching filename mappings from the backend.
 * Maps SHA256 hash filenames to their original human-readable names.
 */
export class FileNameMappingService {
  private cache = new Map<FileType, CacheEntry>()
  private readonly TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get filename mapping for the specified file type.
   * @param fileType - The type of files to get mappings for
   * @returns Promise resolving to the filename mapping
   */
  async getMapping(fileType: FileType = 'input'): Promise<FileNameMapping> {
    const cached = this.cache.get(fileType)

    // Return cached data if valid and not expired
    if (cached && !this.isExpired(cached) && !cached.failed) {
      return cached.data
    }

    // Return cached data if we're already fetching or if previous fetch failed recently
    if (cached?.fetchPromise || (cached?.failed && !this.shouldRetry(cached))) {
      return cached?.data ?? {}
    }

    // Fetch new data
    return this.fetchMapping(fileType)
  }

  /**
   * Get human-readable filename from hash filename.
   * @param hashFilename - The SHA256 hash filename
   * @param fileType - The type of file
   * @returns Promise resolving to human-readable name or original if not found
   */
  async getHumanReadableName(
    hashFilename: string,
    fileType: FileType = 'input'
  ): Promise<string> {
    try {
      const mapping = await this.getMapping(fileType)
      return mapping[hashFilename] ?? hashFilename
    } catch (error) {
      console.warn(
        `Failed to get human readable name for ${hashFilename}:`,
        error
      )
      return hashFilename
    }
  }

  /**
   * Apply filename mapping to an array of hash filenames.
   * @param hashFilenames - Array of SHA256 hash filenames
   * @param fileType - The type of files
   * @returns Promise resolving to array of human-readable names
   */
  async applyMappingToArray(
    hashFilenames: string[],
    fileType: FileType = 'input'
  ): Promise<string[]> {
    try {
      const mapping = await this.getMapping(fileType)
      return hashFilenames.map((filename) => mapping[filename] ?? filename)
    } catch (error) {
      console.warn('Failed to apply filename mapping:', error)
      return hashFilenames
    }
  }

  /**
   * Get cached mapping synchronously (returns empty object if not cached).
   * @param fileType - The file type to get cached mapping for
   * @returns The cached mapping or empty object
   */
  getCachedMapping(fileType: FileType = 'input'): FileNameMapping {
    const cached = this.cache.get(fileType)
    if (cached && !this.isExpired(cached) && !cached.failed) {
      const result = cached.data
      console.debug(
        `[FileNameMapping] getCachedMapping returning cached data:`,
        {
          fileType,
          mappingCount: Object.keys(result).length,
          sampleMappings: Object.entries(result).slice(0, 3)
        }
      )
      return result
    }
    console.debug(
      `[FileNameMapping] getCachedMapping returning empty object for ${fileType} (cache miss)`
    )
    return {}
  }

  /**
   * Get reverse mapping (human-readable name to hash) synchronously.
   * @param fileType - The file type to get reverse mapping for
   * @returns The reverse mapping object
   */
  getCachedReverseMapping(
    fileType: FileType = 'input'
  ): Record<string, string> {
    const mapping = this.getCachedMapping(fileType)
    const reverseMapping: Record<string, string> = {}

    // Build reverse mapping: humanName -> hashName
    for (const [hash, humanName] of Object.entries(mapping)) {
      reverseMapping[humanName] = hash
    }

    return reverseMapping
  }

  /**
   * Convert a human-readable name back to its hash filename.
   * @param humanName - The human-readable filename
   * @param fileType - The file type
   * @returns The hash filename or the original if no mapping exists
   */
  getHashFromHumanName(
    humanName: string,
    fileType: FileType = 'input'
  ): string {
    const reverseMapping = this.getCachedReverseMapping(fileType)
    return reverseMapping[humanName] ?? humanName
  }

  /**
   * Invalidate cached mapping for a specific file type.
   * @param fileType - The file type to invalidate, or undefined to clear all
   */
  invalidateCache(fileType?: FileType): void {
    if (fileType) {
      this.cache.delete(fileType)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Refresh the mapping for a specific file type by clearing cache and fetching new data.
   * @param fileType - The file type to refresh
   * @returns Promise resolving to the new mapping
   */
  async refreshMapping(fileType: FileType = 'input'): Promise<FileNameMapping> {
    console.debug(`[FileNameMapping] Refreshing mapping for ${fileType}`)
    this.invalidateCache(fileType)
    const freshMapping = await this.getMapping(fileType)
    console.debug(`[FileNameMapping] Fresh mapping fetched:`, {
      fileType,
      mappingCount: Object.keys(freshMapping).length,
      sampleMappings: Object.entries(freshMapping).slice(0, 3)
    })
    return freshMapping
  }

  /**
   * Ensures mappings are loaded and cached for immediate synchronous access.
   * Use this to preload mappings before widget creation.
   * @param fileType - The file type to preload
   * @returns Promise that resolves when mappings are loaded
   */
  async ensureMappingsLoaded(fileType: FileType = 'input'): Promise<void> {
    try {
      await this.getMapping(fileType)
    } catch (error) {
      // Errors are already handled in getMapping/performFetch
      // This ensures we don't break the app initialization
      console.debug(
        '[FileNameMappingService] Preload completed with fallback to empty mapping'
      )
    }
  }

  private async fetchMapping(fileType: FileType): Promise<FileNameMapping> {
    const cacheKey = fileType
    let entry = this.cache.get(cacheKey)

    if (!entry) {
      entry = { data: {}, timestamp: 0 }
      this.cache.set(cacheKey, entry)
    }

    // Prevent concurrent requests for the same fileType
    if (entry.fetchPromise) {
      return entry.fetchPromise
    }

    // Set up fetch promise to prevent concurrent requests
    entry.fetchPromise = this.performFetch(fileType)

    try {
      const data = await entry.fetchPromise

      // Update cache with successful result
      entry.data = data
      entry.timestamp = Date.now()
      entry.error = null
      entry.failed = false

      return data
    } catch (error) {
      // Should not happen as performFetch now returns empty mapping on error
      // But keep for safety
      entry.error = error instanceof Error ? error : new Error(String(error))
      entry.failed = true

      console.debug(`[FileNameMappingService] Using fallback for ${fileType}`)
      return entry.data // Return existing data or empty object
    } finally {
      // Clear the promise after completion
      entry.fetchPromise = undefined
    }
  }

  private async performFetch(fileType: FileType): Promise<FileNameMapping> {
    // Check if api is available
    if (!api || typeof api.fetchApi !== 'function') {
      console.warn(
        '[FileNameMappingService] API not available, returning empty mapping'
      )
      return {}
    }

    let response: Response
    try {
      response = await api.fetchApi(`/files/mappings`)
    } catch (error) {
      console.warn(
        '[FileNameMappingService] Network error fetching mappings:',
        error
      )
      return {} // Return empty mapping instead of throwing
    }

    if (!response.ok) {
      console.warn(
        `[FileNameMappingService] Server returned ${response.status} ${response.statusText}, using empty mapping`
      )
      return {} // Graceful degradation
    }

    let data: any
    try {
      // Check if response has json method
      if (typeof response.json !== 'function') {
        console.warn('[FileNameMappingService] Response has no json() method')
        return {}
      }
      data = await response.json()
    } catch (jsonError) {
      console.warn(
        '[FileNameMappingService] Failed to parse JSON response:',
        jsonError
      )
      return {} // Return empty mapping on parse error
    }

    // Validate response structure
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      console.warn(
        '[FileNameMappingService] Invalid response format, expected object'
      )
      return {}
    }

    // Validate and filter entries
    const validEntries: FileNameMapping = {}
    let invalidEntryCount = 0

    for (const [key, value] of Object.entries(data)) {
      if (typeof key === 'string' && typeof value === 'string') {
        validEntries[key] = value
      } else {
        invalidEntryCount++
      }
    }

    if (invalidEntryCount > 0) {
      console.debug(
        `[FileNameMappingService] Filtered out ${invalidEntryCount} invalid entries`
      )
    }

    console.debug(
      `[FileNameMappingService] Loaded ${Object.keys(validEntries).length} mappings for '${fileType}'`
    )

    return validEntries
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.TTL
  }

  private shouldRetry(entry: CacheEntry): boolean {
    // Allow retry after 30 seconds for failed requests
    return entry.timestamp > 0 && Date.now() - entry.timestamp > 30000
  }
}

// Singleton instance
export const fileNameMappingService = new FileNameMappingService()
