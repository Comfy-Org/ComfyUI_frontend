import { api } from '@/scripts/api'

export type FileType = 'input' | 'output' | 'temp'

export interface FileNameMapping {
  [hashFilename: string]: string // hash -> human readable name
}

export interface CacheEntry {
  data: FileNameMapping
  dedupData?: FileNameMapping // Deduplicated mapping with unique display names
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
  private readonly MAX_MAPPING_SIZE = 10000 // Maximum entries per mapping
  private readonly MAX_FILENAME_LENGTH = 256 // Maximum filename length
  private cleanupTimer: NodeJS.Timeout | null = null

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
      // Log error without exposing file paths
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to get human readable name:', error)
      }
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
      // Log error without exposing sensitive data
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to apply filename mapping')
      }
      return hashFilenames
    }
  }

  /**
   * Get cached mapping synchronously (returns empty object if not cached).
   * @param fileType - The file type to get cached mapping for
   * @param deduplicated - Whether to return deduplicated names for display
   * @returns The cached mapping or empty object
   */
  getCachedMapping(
    fileType: FileType = 'input',
    deduplicated: boolean = false
  ): FileNameMapping {
    const cached = this.cache.get(fileType)
    if (cached && !this.isExpired(cached) && !cached.failed) {
      // Return deduplicated mapping if requested and available
      if (deduplicated && cached.dedupData) {
        return cached.dedupData
      }
      const result = cached.data
      return result
    }
    // Cache miss - return empty object
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

    // Schedule cleanup if not already scheduled
    this.scheduleCleanup()

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

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.TTL
  }

  private shouldRetry(entry: CacheEntry): boolean {
    // Allow retry after 30 seconds for failed requests
    return entry.timestamp > 0 && Date.now() - entry.timestamp > 30000
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

        // Extract file extension if present
        const lastDotIndex = humanName.lastIndexOf('.')
        let baseName = humanName
        let extension = ''

        if (lastDotIndex > 0 && lastDotIndex < humanName.length - 1) {
          baseName = humanName.substring(0, lastDotIndex)
          extension = humanName.substring(lastDotIndex)
        }

        // Add suffix: use first 8 chars of hash (without extension)
        // Remove extension from hash if present
        const hashWithoutExt = hash.includes('.')
          ? hash.substring(0, hash.lastIndexOf('.'))
          : hash
        const hashSuffix = hashWithoutExt.substring(0, 8)
        dedupMapping[hash] = `${baseName}_${hashSuffix}${extension}`
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
   * Schedule automatic cleanup of expired cache entries
   */
  private scheduleCleanup(): void {
    if (this.cleanupTimer) {
      return // Already scheduled
    }

    // Schedule cleanup to run after TTL expires
    this.cleanupTimer = setTimeout(() => {
      this.cleanupExpiredEntries()
      this.cleanupTimer = null
    }, this.TTL)
  }

  /**
   * Remove expired entries from cache to prevent memory leaks
   */
  private cleanupExpiredEntries(): void {
    const entriesToDelete: FileType[] = []

    // Find expired entries
    this.cache.forEach((entry, fileType) => {
      if (this.isExpired(entry) && !entry.fetchPromise) {
        entriesToDelete.push(fileType)
      }
    })

    // Remove expired entries
    entriesToDelete.forEach((fileType) => {
      this.cache.delete(fileType)
    })
  }

  /**
   * Cleanup method for proper disposal
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.cache.clear()
  }
}

// Singleton instance
export const fileNameMappingService = new FileNameMappingService()
