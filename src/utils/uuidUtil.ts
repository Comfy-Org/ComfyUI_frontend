import { validate } from 'uuid'

/**
 * UUID utility functions
 * Used for extracting prompt IDs from asset IDs in the media assets feature
 */

/**
 * Regular expression for matching UUID format at the beginning of a string
 * Format: 8-4-4-4-12 (e.g., 98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3)
 * Example use case: "98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3-nodeId-filename.png"
 */
const UUID_REGEX =
  /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i

/**
 * Extract UUID from the beginning of a string
 * Used when asset IDs contain UUIDs as prefixes (e.g., "uuid-nodeId-filename")
 * @param str - The string to extract UUID from
 * @returns The extracted UUID or null if not found
 */
export function extractUuidFromString(str: string): string | null {
  const match = str.match(UUID_REGEX)
  if (!match) return null

  const uuid = match[1]
  return validate(uuid) ? uuid : null
}

/**
 * Extract prompt ID from asset ID
 * Asset ID format: "promptId-nodeId-filename"
 * @param assetId - The asset ID string
 * @returns The extracted prompt ID (UUID) or null
 */
export function extractPromptIdFromAssetId(assetId: string): string | null {
  return extractUuidFromString(assetId)
}
