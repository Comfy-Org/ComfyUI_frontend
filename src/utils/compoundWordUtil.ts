import { words } from 'es-toolkit/compat'

/**
 * Splits a compound identifier into its constituent words and rejoins them
 * with spaces, so a search backend with no camelCase/PascalCase
 * word-segmentation of its own (e.g. Algolia) can match a compound query
 * term-by-term instead of as one unsegmented blob.
 *
 * Handles camelCase/PascalCase transitions, hyphens, underscores, and
 * letter/digit boundaries, while keeping acronym runs like `SDXL` intact.
 * Already-space-separated input passes through unchanged.
 *
 * @example
 * tokenizeCompoundWords('EulerDiscreteScheduler') // 'Euler Discrete Scheduler'
 * tokenizeCompoundWords('ComfyUI-SDXL_v2Turbo') // 'Comfy UI SDXL v 2 Turbo'
 * tokenizeCompoundWords('already spaced') // 'already spaced'
 */
export function tokenizeCompoundWords(input: string): string {
  return words(input).join(' ')
}
