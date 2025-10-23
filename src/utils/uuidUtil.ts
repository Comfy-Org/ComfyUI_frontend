import { validate as uuidValidate } from 'uuid'

/**
 * UUID utility functions
 */

/**
 * Regular expression for matching UUID format at the beginning of a string
 * Format: 8-4-4-4-12 (e.g., 98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3)
 */
const UUID_REGEX =
  /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i

/**
 * Extract UUID from the beginning of a string
 * @param str - The string to extract UUID from
 * @returns The extracted UUID or null if not found
 */
export function extractUuidFromString(str: string): string | null {
  const match = str.match(UUID_REGEX)
  if (!match) return null

  const uuid = match[1]
  // Validate the extracted string is a valid UUID
  return uuidValidate(uuid) ? uuid : null
}

/**
 * Check if a string is a valid UUID (any version)
 * @param str - The string to check
 * @returns true if the string is a valid UUID
 */
export function isValidUuid(str: string): boolean {
  return uuidValidate(str)
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
