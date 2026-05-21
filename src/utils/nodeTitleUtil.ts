import { normalizeI18nKey } from '@/utils/formatUtil'

type NodeTitleInfo = {
  title?: string | number | null
  type?: string | number | null
}

type StaticTranslate = (key: string, fallbackMessage: string) => string

type ResolveNodeDisplayNameOptions = {
  emptyLabel: string
  untitledLabel: string
  st: StaticTranslate
}

/**
 * Short labels for well-known noisy node titles. Keeps the panel
 * subtitle readable in two-column layouts where "Empty Latent Image"
 * would truncate to "Empty Latent Ima…". Compared case-insensitively
 * against the raw node title.
 *
 * Known follow-up (CR): values are hard-coded English; non-English
 * locales fall back to the raw title via the `??` chain in
 * `friendlyNodeLabel`. Threading a translator (mirroring
 * `resolveNodeDisplayName`) is the right path but needs new keys in
 * every locale file — deferred to a separate PR.
 */
const SHORT_NODE_LABELS: Record<string, string> = {
  'empty latent image': 'Image',
  'load image': 'Image',
  'load checkpoint': 'Model',
  checkpointloadersimple: 'Model',
  ksampler: 'Sampler',
  'vae decode': 'Decode',
  'vae encode': 'Encode',
  'save image': 'Save',
  'preview image': 'Preview'
}

/**
 * User-friendly label for a widget's source node, intended for the
 * subtitle shown next to each input in the App Mode / App Builder
 * floating panel. Non-technical users don't need to see the node class
 * ("CLIP Text Encode"); they only care about what the author annotated
 * in parens ("Positive Prompt"). If parens content is present, return
 * that. Otherwise consult the short-label map so verbose titles like
 * "Empty Latent Image" collapse to "Image". Final fallback is the
 * original title so the subtitle still disambiguates two inputs sharing
 * a label.
 */
export function friendlyNodeLabel(title: string | undefined | null): string {
  const trimmed = title?.trim() ?? ''
  if (!trimmed) return ''
  const match = trimmed.match(/\(([^)]+)\)/)
  const inside = match?.[1]?.trim()
  if (inside && inside.length > 0) return inside
  const short = SHORT_NODE_LABELS[trimmed.toLowerCase()]
  return short ?? trimmed
}

export function resolveNodeDisplayName(
  node: NodeTitleInfo | null | undefined,
  options: ResolveNodeDisplayNameOptions
): string {
  if (!node) return options.emptyLabel

  const title = (node.title ?? '').toString().trim()
  if (title.length > 0) return title

  const nodeType = (node.type ?? '').toString().trim() || options.untitledLabel
  const key = `nodeDefs.${normalizeI18nKey(nodeType)}.display_name`
  return options.st(key, nodeType)
}
