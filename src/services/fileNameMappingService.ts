import { api } from '@/scripts/api'

type FileType = 'input' | 'output' | 'temp'

export interface FileNameMapping {
  [assetId: string]: string // asset-id -> asset name
}

interface CacheEntry {
  data: FileNameMapping
  dedupData?: FileNameMapping // Deduplicated mapping with unique display names
  timestamp: number
  error?: Error | null
  fetchPromise?: Promise<FileNameMapping>
  failed?: boolean
}

/**
 * Service for fetching and caching asset mappings from the backend.
 * Maps asset IDs (UUIDs) to their human-readable asset names.
 */
export class FileNameMappingService {
  private cache = new Map<FileType, CacheEntry>()
  private readonly MAX_MAPPING_SIZE = 10000 // Maximum entries per mapping
  private readonly MAX_FILENAME_LENGTH = 256 // Maximum filename length
  private readonly RETRY_DELAY = 30 * 1000 // 30 seconds retry for failed fetches

  /**
   * Get filename mapping for the specified file type.
   * @param fileType - The type of files to get mappings for
   * @returns Promise resolving to the filename mapping
   */
  async getMapping(fileType: FileType = 'input'): Promise<FileNameMapping> {
    const cached = this.cache.get(fileType)

    // Return cached data if available and valid
    if (cached && cached.data && !cached.failed) {
      return cached.data
    }

    // Return cached data if we're already fetching
    if (cached?.fetchPromise) {
      return cached?.data ?? {}
    }

    // Only retry failed fetches after delay
    if (
      cached?.failed &&
      cached.timestamp &&
      Date.now() - cached.timestamp < this.RETRY_DELAY
    ) {
      return cached?.data ?? {}
    }

    // Fetch new data
    return this.fetchMapping(fileType)
  }

  /**
   * Get human-readable asset name from asset ID.
   * @param assetId - The asset ID (UUID)
   * @param fileType - The type of file
   * @returns Promise resolving to human-readable name or original if not found
   */
  async getHumanReadableName(
    assetId: string,
    fileType: FileType = 'input'
  ): Promise<string> {
    try {
      const mapping = await this.getMapping(fileType)
      return mapping[assetId] ?? assetId
    } catch (error) {
      // Log error without exposing file paths
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to get human readable name:', error)
      }
      return assetId
    }
  }

  /**
   * Apply asset mapping to an array of asset IDs.
   * @param assetIds - Array of asset IDs (UUIDs)
   * @param fileType - The type of files
   * @returns Promise resolving to array of human-readable names
   */
  async applyMappingToArray(
    assetIds: string[],
    fileType: FileType = 'input'
  ): Promise<string[]> {
    try {
      const mapping = await this.getMapping(fileType)
      return assetIds.map((assetId) => mapping[assetId] ?? assetId)
    } catch (error) {
      // Log error without exposing sensitive data
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to apply asset mapping')
      }
      return assetIds
    }
  }

  /**
   * Get cached mapping synchronously (returns stale data if expired).
   * @param fileType - The file type to get cached mapping for
   * @param deduplicated - Whether to return deduplicated names for display
   * @returns The cached mapping or empty object
   */
  getCachedMapping(
    fileType: FileType = 'input',
    deduplicated: boolean = false
  ): FileNameMapping {
    const cached = this.cache.get(fileType)

    // Always return cached data if available
    // Mappings persist for the entire session
    if (cached && cached.data) {
      // Return deduplicated mapping if requested and available
      if (deduplicated && cached.dedupData) {
        return cached.dedupData
      }
      return cached.data
    }

    // Only return empty object if we truly have no data
    // This should only happen on first load before initial fetch
    return {}
  }

  /**
   * Get reverse mapping (human-readable name to hash) synchronously.
   * @param fileType - The file type to get reverse mapping for
   * @param deduplicated - Whether to use deduplicated names
   * @returns The reverse mapping object
   */
  getCachedReverseMapping(
    fileType: FileType = 'input',
    deduplicated: boolean = false
  ): Record<string, string> {
    const mapping = this.getCachedMapping(fileType, deduplicated)
    const reverseMapping: Record<string, string> = {}

    // Build reverse mapping: humanName -> hashName
    for (const [hash, humanName] of Object.entries(mapping)) {
      reverseMapping[humanName] = hash
    }

    return reverseMapping
  }

  /**
   * Convert a human-readable name back to its asset ID.
   * @param humanName - The human-readable asset name
   * @param fileType - The file type
   * @returns The asset ID or the original if no mapping exists
   */
  getAssetIdFromHumanName(
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
    this.invalidateCache(fileType)
    const freshMapping = await this.getMapping(fileType)
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
      entry.dedupData = this.deduplicateMapping(data)
      entry.timestamp = Date.now()
      entry.error = null
      entry.failed = false

      return data
    } catch (error) {
      // Should not happen as performFetch now returns empty mapping on error
      // But keep for safety
      entry.error = error instanceof Error ? error : new Error(String(error))
      entry.failed = true

      // Using fallback for failed fetch
      return entry.data // Return existing data or empty object
    } finally {
      // Clear the promise after completion
      entry.fetchPromise = undefined
    }
  }

  private async performFetch(_fileType: FileType): Promise<FileNameMapping> {
    // Check if api is available
    if (!api || typeof api.fetchApi !== 'function') {
      // API not available - return empty mapping silently
      return {}
    }

    let response: Response
    try {
      response = await api.fetchApi(`/files/mappings`)
    } catch (error) {
      // Network error - return empty mapping silently
      return {} // Return empty mapping instead of throwing
    }

    if (!response.ok) {
      // Non-OK response - use empty mapping silently
      return {} // Graceful degradation
    }

    let data: any
    try {
      // Check if response has json method
      if (typeof response.json !== 'function') {
        // Response has no json() method - return empty
        return {}
      }
      data = await response.json()
    } catch (jsonError) {
      // JSON parse error - return empty mapping silently
      return {} // Return empty mapping on parse error
    }

    // Validate response structure
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      // Invalid response format - return empty mapping silently
      return {}
    }

    // Validate and filter entries
    const validEntries: FileNameMapping = {}
    let invalidEntryCount = 0
    let entryCount = 0

    for (const [key, value] of Object.entries(data)) {
      // Enforce maximum mapping size
      if (entryCount >= this.MAX_MAPPING_SIZE) {
        // Mapping size exceeds limit - truncate silently
        break
      }

      // Validate entry types and content
      if (
        typeof key === 'string' &&
        typeof value === 'string' &&
        this.isValidFilename(key) &&
        this.isValidFilename(value)
      ) {
        validEntries[key] = value
        entryCount++
      } else {
        invalidEntryCount++
      }
    }

    // Log if entries were filtered
    if (invalidEntryCount > 0) {
      // Some entries were filtered due to validation
    }

    return validEntries
  }

  /**
   * Deduplicate human-readable names when multiple hashes map to the same name.
   * Adds a suffix to duplicate names to make them unique.
   * @param mapping - The original hash -> human name mapping
   * @returns A new mapping with deduplicated human names
   */
  private deduplicateMapping(mapping: FileNameMapping): FileNameMapping {
    const dedupMapping: FileNameMapping = {}
    const nameCount = new Map<string, number>()
    const nameToHashes = new Map<string, string[]>()

    // First pass: count occurrences of each human name
    for (const [hash, humanName] of Object.entries(mapping)) {
      const count = nameCount.get(humanName) || 0
      nameCount.set(humanName, count + 1)

      // Track which hashes map to this human name
      const hashes = nameToHashes.get(humanName) || []
      hashes.push(hash)
      nameToHashes.set(humanName, hashes)
    }

    // Second pass: create deduplicated names
    const nameIndex = new Map<string, number>()

    for (const [hash, humanName] of Object.entries(mapping)) {
      const count = nameCount.get(humanName) || 1

      if (count === 1) {
        // No duplicates, use original name
        dedupMapping[hash] = humanName
      } else {
        // Has duplicates, add suffix
        const currentIndex = (nameIndex.get(humanName) || 0) + 1
        nameIndex.set(humanName, currentIndex)

        // Extract file extension from human name if present
        const lastDotIndex = humanName.lastIndexOf('.')
        let baseName = humanName
        let extension = ''

        if (lastDotIndex > 0 && lastDotIndex < humanName.length - 1) {
          baseName = humanName.substring(0, lastDotIndex)
          extension = humanName.substring(lastDotIndex)
        }

        // Create suffix from hash/UUID
        let hashSuffix: string
        if (
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
            hash
          )
        ) {
          // UUID format - use first 8 characters
          hashSuffix = hash.substring(0, 8)
        } else {
          // Legacy hash format - remove extension if present and take first 8 chars
          const hashWithoutExt = hash.includes('.')
            ? hash.substring(0, hash.lastIndexOf('.'))
            : hash
          hashSuffix = hashWithoutExt.substring(0, 8)
        }

        const dedupName = `${baseName}_${hashSuffix}${extension}`
        dedupMapping[hash] = dedupName
      }
    }

    // Deduplication complete

    return dedupMapping
  }

  /**
   * Validate filename for security and length constraints
   */
  private isValidFilename(filename: string): boolean {
    // Check length
    if (filename.length === 0 || filename.length > this.MAX_FILENAME_LENGTH) {
      return false
    }

    // Check for dangerous characters or patterns
    // Disallow: < > : " | ? * and control characters (0x00-0x1f)
    // eslint-disable-next-line no-control-regex
    const dangerousPattern = /[<>:"|?*\x00-\x1f]/
    if (dangerousPattern.test(filename)) {
      return false
    }

    // Disallow path traversal attempts
    if (filename.includes('../') || filename.includes('..\\')) {
      return false
    }

    return true
  }

  /**
   * Cleanup method for proper disposal
   */
  dispose(): void {
    this.cache.clear()
  }
}

// Singleton instance
export const fileNameMappingService = new FileNameMappingService()
