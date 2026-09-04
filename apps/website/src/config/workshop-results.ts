/**
 * Finding the media in a partner model's output.
 *
 * Router returns the partner's own JSON unchanged, so there is no field we
 * are entitled to expect: one model answers `{images:[{url}]}`, another
 * `{video:{url}}`, another a bare `{url}`. Rather than maintain a per-model
 * map that silently rots as partners change, this walks the document and
 * collects anything that looks like a media URL, and the page shows the raw
 * JSON alongside so nothing found here is the only thing on screen.
 *
 * What a URL should be *rendered* as comes from the model's modality in the
 * catalog, not from guessing at the URL, because Router re-hosts results on
 * Comfy storage and those URLs need not carry a usable extension.
 */

/** Keys whose values are URLs pointing at the input, not the result. */
const INPUT_KEYS = new Set([
  'input',
  'inputs',
  'medias',
  'source',
  'sources',
  'reference',
  'references'
])

const MAX_DEPTH = 8

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMediaUrl(value: string): boolean {
  return (
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('data:image/') ||
    value.startsWith('data:video/') ||
    value.startsWith('data:audio/')
  )
}

/**
 * Every media URL in the output, in document order, deduplicated.
 *
 * Depth-bounded rather than trusting the document to be shallow: this parses
 * a response from a third party, and a cyclic or pathological one should
 * produce a short list, not a hung tab.
 */
export function extractMediaUrls(output: unknown): string[] {
  const found: string[] = []
  const seen = new Set<string>()

  function walk(node: unknown, depth: number): void {
    if (depth > MAX_DEPTH) return
    if (typeof node === 'string') {
      if (isMediaUrl(node) && !seen.has(node)) {
        seen.add(node)
        found.push(node)
      }
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    if (isRecord(node)) {
      for (const [key, item] of Object.entries(node)) {
        if (INPUT_KEYS.has(key)) continue
        walk(item, depth + 1)
      }
    }
  }

  walk(output, 0)
  return found
}

export type WorkshopMediaKind = 'image' | 'video' | 'audio' | 'link'

/**
 * How to render a result URL, decided by what the model produces rather than
 * by the URL itself. `3d` and `svg` get a link: neither is something a plain
 * `<img>` can be trusted with, and a download is the honest affordance.
 */
export function mediaKindForModality(modality: string): WorkshopMediaKind {
  if (modality === 'image') return 'image'
  if (modality === 'video') return 'video'
  if (modality === 'audio' || modality === 'music') return 'audio'
  return 'link'
}
