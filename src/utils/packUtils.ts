import { mapKeys } from 'es-toolkit/compat'

/**
 * Normalizes a pack ID by removing the version suffix.
 *
 * ComfyUI-Manager returns pack IDs in different formats:
 * - Enabled packs: "packname" (without version)
 * - Disabled packs: "packname@1_0_3" (with version suffix)
 * - Latest versions from registry: "packname" (without version)
 *
 * Since the pack object itself contains the version info (ver field),
 * we normalize all pack IDs to just the base name for consistent access.
 * This ensures we can always find a pack by its base name (nodePack.id)
 * regardless of its enabled/disabled state.
 *
 * @param packId - The pack ID that may contain a version suffix
 * @returns The normalized pack ID without version suffix
 *
 * @example
 * normalizePackId("ComfyUI-GGUF") // "ComfyUI-GGUF"
 * normalizePackId("ComfyUI-GGUF@1_1_4") // "ComfyUI-GGUF"
 */
export function normalizePackId(packId: string): string {
  return packId.split('@')[0]
}

/**
 * Normalizes all keys in a pack record by removing version suffixes.
 * This is used when receiving pack data from the server to ensure
 * consistent key format across the application.
 *
 * @param packs - Record of packs with potentially versioned keys
 * @returns Record with normalized keys
 *
 * @example
 * normalizePackKeys({
 *   "ComfyUI-GGUF": { ver: "1.1.4", enabled: true },
 *   "ComfyUI-Manager@2_0_0": { ver: "2.0.0", enabled: false }
 * })
 * // Returns:
 * // {
 * //   "ComfyUI-GGUF": { ver: "1.1.4", enabled: true },
 * //   "ComfyUI-Manager": { ver: "2.0.0", enabled: false }
 * // }
 */
export function normalizePackKeys<T>(
  packs: Record<string, T>
): Record<string, T> {
  return mapKeys(packs, (_value, key) => normalizePackId(key))
}
