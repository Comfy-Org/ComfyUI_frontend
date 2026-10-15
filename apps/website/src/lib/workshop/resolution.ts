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

function normalizeResolution(raw: string): Resolution | undefined {
  const value = raw.trim().toLowerCase()
  const label =
    NAMED[value] ?? (/^\d+(\.\d+)?k$/.test(value) ? value.toUpperCase() : value)
  return RESOLUTIONS.find((resolution) => resolution === label)
}

function resolutionOptions(node: object, key: string | undefined) {
  const options = 'enum' in node ? node.enum : undefined
  if (!key || !RESOLUTION_KEYS.has(key) || !Array.isArray(options)) return []
  return options.flatMap((option) =>
    typeof option === 'string' ? (normalizeResolution(option) ?? []) : []
  )
}

function collect(
  node: unknown,
  key: string | undefined,
  found: Set<Resolution>
) {
  if (!node || typeof node !== 'object') return
  for (const resolution of resolutionOptions(node, key)) found.add(resolution)
  const children = Array.isArray(node)
    ? node.map((child): [undefined, unknown] => [undefined, child])
    : Object.entries(node)
  for (const [childKey, child] of children) collect(child, childKey, found)
}

/** The resolutions a Router input schema offers, highest first. */
export function resolutionsIn(schema: unknown): Resolution[] {
  const found = new Set<Resolution>()
  collect(schema, undefined, found)
  return RESOLUTIONS.filter((resolution) => found.has(resolution))
}

export function parseResolution(search: string): Resolution | undefined {
  const named = new URLSearchParams(search).get(RESOLUTION_PARAM)
  return named ? normalizeResolution(named) : undefined
}
