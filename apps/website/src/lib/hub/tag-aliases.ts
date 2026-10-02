// The Hub stores the original tag (e.g. "API") and displays an alias.
const TAG_ALIASES: Record<string, string> = {
  API: 'Partner Nodes'
}

const WORD_LABELS: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  llm: 'LLM',
  '3d': '3D',
  bfl: 'BFL',
  byteplus: 'BytePlus',
  vertexai: 'VertexAI'
}

export function tagDisplayName(tag: string, titleCase = false): string {
  const label = TAG_ALIASES[tag] ?? tag
  if (!titleCase) return label
  return label
    .split(/[-_\s]+/)
    .map((word, index) => {
      const normalized = word.toLowerCase()
      if (index > 0 && ['to', 'and', 'with', 'of'].includes(normalized))
        return normalized
      return (
        WORD_LABELS[normalized] ?? word.charAt(0).toUpperCase() + word.slice(1)
      )
    })
    .join(' ')
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function tagSlug(tag: string): string {
  return slugify(TAG_ALIASES[tag] ?? tag)
}
