/**
 * Normalizes a tag to its slug form for the ComfyHub API.
 * Converts display names like "Text to Image" to "text-to-image".
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-')
}

/**
 * Normalizes and deduplicates an array of tags for API submission.
 */
export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))]
}
