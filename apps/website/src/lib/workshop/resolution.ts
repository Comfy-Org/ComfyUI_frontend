/** Output resolutions, highest first, as a visitor reads them. */
export const RESOLUTIONS = [
  '4K',
  '3K',
  '2K',
  '1.5K',
  '1080p',
  '1K',
  '720p',
  '540p',
  '480p'
] as const
export type Resolution = (typeof RESOLUTIONS)[number]

export const RESOLUTION_PARAM = 'resolution'

const NAMED: Readonly<Record<string, Resolution>> = { hd: '720p', fhd: '1080p' }
const RESOLUTION_KEYS = new Set([
  'resolution',
  'size',
  'image_size',
  'output_resolution'
])

/**
 * A provider's label for a resolution, in one spelling: 720P and 720p read
 * the same, as do 2k and 2K, and HD and Full HD name 720p and 1080p. Pixel
 * sizes and aspect ratios are not resolutions here and give nothing.
 */
export function normalizeResolution(raw: string): Resolution | undefined {
  const value = raw.trim().toLowerCase()
  const label =
    NAMED[value] ?? (/^\d+(\.\d+)?k$/.test(value) ? value.toUpperCase() : value)
  return RESOLUTIONS.find((resolution) => resolution === label)
}

/** The resolutions a Router input schema offers, highest first. */
export function resolutionsIn(schema: unknown): Resolution[] {
  const found = new Set<Resolution>()
  const walk = (node: unknown, key?: string) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    const entries = Object.entries(node)
    const options = (node as { enum?: unknown }).enum
    if (key && RESOLUTION_KEYS.has(key) && Array.isArray(options))
      for (const option of options) {
        const resolution =
          typeof option === 'string' ? normalizeResolution(option) : undefined
        if (resolution) found.add(resolution)
      }
    for (const [childKey, child] of entries) walk(child, childKey)
  }
  walk(schema)
  return RESOLUTIONS.filter((resolution) => found.has(resolution))
}

export function parseResolution(search: string): Resolution | undefined {
  const named = new URLSearchParams(search).get(RESOLUTION_PARAM)
  return named ? normalizeResolution(named) : undefined
}
