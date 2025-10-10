/**
 * Store for mask metadata from cloud backend
 * This helps identify masks when using hash-based filenames
 */

interface MaskMetadata {
  is_mask: boolean
  original_hash?: string
  mask_type?: string
  related_files?: {
    mask?: string
    paint?: string
    painted?: string
  }
}

class MaskMetadataStore {
  private metadata: Map<string, MaskMetadata> = new Map()

  /**
   * Store metadata for a file
   * @param filename The filename (hash) of the file
   * @param metadata The metadata from the backend
   */
  setMetadata(filename: string, metadata: MaskMetadata | undefined) {
    if (!metadata || !filename) return

    console.log('[MaskMetadataStore] Storing metadata for', filename, metadata)
    this.metadata.set(filename, metadata)
  }

  /**
   * Get metadata for a file
   * @param filename The filename (hash) to look up
   */
  getMetadata(filename: string): MaskMetadata | undefined {
    return this.metadata.get(filename)
  }

  /**
   * Check if a file is a mask based on metadata
   * @param filename The filename to check
   */
  isMask(filename: string): boolean {
    const metadata = this.getMetadata(filename)
    return metadata?.is_mask === true
  }

  /**
   * Get the original image hash for a mask
   * @param filename The mask filename
   */
  getOriginalHash(filename: string): string | undefined {
    const metadata = this.getMetadata(filename)
    return metadata?.original_hash
  }

  /**
   * Store related files for a mask (from upload response)
   * @param filename The mask filename
   * @param relatedFiles The related files object
   */
  setRelatedFiles(filename: string, relatedFiles: any) {
    const metadata = this.metadata.get(filename)
    if (metadata) {
      metadata.related_files = relatedFiles
      this.metadata.set(filename, metadata)
    } else {
      // Create new metadata entry with just related files
      this.metadata.set(filename, {
        is_mask: true,
        related_files: relatedFiles
      })
    }
  }

  /**
   * Get related files for a mask
   * @param filename The mask filename
   */
  getRelatedFiles(filename: string): MaskMetadata['related_files'] | undefined {
    const metadata = this.getMetadata(filename)
    return metadata?.related_files
  }

  /**
   * Clear all stored metadata
   */
  clear() {
    this.metadata.clear()
  }
}

// Export singleton instance
export const maskMetadataStore = new MaskMetadataStore()
