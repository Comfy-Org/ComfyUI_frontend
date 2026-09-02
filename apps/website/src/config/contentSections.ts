import { hasKey, t, translationKeys } from '../i18n/translations'

type BlockType =
  | 'paragraph'
  | 'list'
  | 'ordered-list'
  | 'heading'
  | 'image'
  | 'blockquote'
  | 'author'

interface BlockConfig {
  type: BlockType
}

interface SectionConfig {
  id: string
  hasTitle: boolean
  blocks: BlockConfig[]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function inferBlockType(
  prefix: string,
  sectionId: string,
  i: number
): BlockType {
  const bp = `${prefix}.${sectionId}.block.${i}`

  if (hasKey(`${bp}.src`)) return 'image'
  if (hasKey(`${bp}.text`)) return 'blockquote'
  if (hasKey(`${bp}.role`)) return 'author'
  if (hasKey(`${bp}.heading`)) return 'heading'
  if (hasKey(`${bp}.ol`)) return 'ordered-list'

  const value = hasKey(bp) ? t(bp as never) : ''
  if (value.includes('\n')) return 'list'
  return 'paragraph'
}

export function deriveSections(prefix: string): SectionConfig[] {
  const labelRegex = new RegExp(`^${escapeRegex(prefix)}\\.([^.]+)\\.label$`)
  const sectionIds: string[] = []

  for (const key of translationKeys) {
    const match = key.match(labelRegex)
    if (match && !sectionIds.includes(match[1])) {
      sectionIds.push(match[1])
    }
  }

  return sectionIds.map((id) => {
    const hasTitle = hasKey(`${prefix}.${id}.title`)

    const blockRegex = new RegExp(
      `^${escapeRegex(prefix)}\\.${escapeRegex(id)}\\.block\\.(\\d+)(?:\\.|$)`
    )
    const blockIndices = new Set<number>()
    for (const key of translationKeys) {
      const match = key.match(blockRegex)
      if (match) blockIndices.add(parseInt(match[1]))
    }

    const blocks = Array.from(blockIndices)
      .sort((a, b) => a - b)
      .map((i) => ({ type: inferBlockType(prefix, id, i) }))

    return { id, hasTitle, blocks }
  })
}
